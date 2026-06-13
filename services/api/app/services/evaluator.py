"""Three-stage evaluation pipeline: transcript → Gemini structured output → DB."""

import logging
import uuid

from google import genai
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session_factory
from app.models import (
    Attempt,
    Challenge,
    CommunicationMetric,
    FeedbackReport,
    Profile,
    Score,
    Session,
    Transcript,
)
from app.services.memory import retrieve_memories, store_memory
from app.services.metrics import compute_metrics
from app.schemas.evaluation import (
    EvaluationResult,
    RoleplayEvaluationResult,
    StageEvaluation,
)
from app.services.prompts import (
    BASE_RUBRIC,
    ROLEPLAY_RUBRIC,
    build_evaluation_prompt,
    build_roleplay_prompt,
)

logger = logging.getLogger(__name__)


async def run_evaluation(attempt_id: uuid.UUID) -> None:
    """Background task entrypoint: evaluate an attempt that is in `evaluating`."""
    factory = get_session_factory()
    async with factory() as db:
        try:
            await _evaluate(db, attempt_id)
        except Exception:
            logger.exception("Evaluation failed for attempt %s", attempt_id)
            await db.rollback()
            attempt = await db.get(Attempt, attempt_id)
            if attempt is not None:
                attempt.status = "failed"
                await db.commit()


async def _evaluate(db: AsyncSession, attempt_id: uuid.UUID) -> None:
    attempt = await db.get(Attempt, attempt_id)
    if attempt is None or attempt.status != "evaluating":
        return
    transcript = (
        await db.execute(select(Transcript).where(Transcript.attempt_id == attempt_id))
    ).scalar_one()
    session = await db.get(Session, attempt.session_id)
    challenge = await db.get(Challenge, session.challenge_id)
    profile = await db.get(Profile, attempt.user_id)

    is_roleplay = challenge.mode == "roleplay"
    # Personalize: pull this speaker's most relevant past memories into the prompt.
    history = await retrieve_memories(
        db, attempt.user_id, f"{challenge.title}: {challenge.prompt}"
    )
    result = await _call_gemini(
        challenge, profile, transcript.full_text, attempt, is_roleplay, history
    )

    stage_names = ("thought", "structure", "delivery", "social") if is_roleplay else (
        "thought",
        "structure",
        "delivery",
    )
    for stage_name in stage_names:
        stage: StageEvaluation = getattr(result, stage_name)
        db.add(
            Score(
                id=uuid.uuid4(),
                attempt_id=attempt.id,
                user_id=attempt.user_id,
                stage=stage_name,
                score=round(stage.score, 1),
                dimensions=[d.model_dump() for d in stage.dimensions],
                summary=stage.summary,
            )
        )

    stage_scores = [getattr(result, s).score for s in stage_names]
    overall = round(sum(stage_scores) / len(stage_scores), 1)
    db.add(
        FeedbackReport(
            id=uuid.uuid4(),
            attempt_id=attempt.id,
            user_id=attempt.user_id,
            overall_score=overall,
            diagnosis=result.diagnosis,
            strengths=result.strengths,
            weaknesses=result.weaknesses,
            best_sentence=result.best_sentence.model_dump(),
            worst_sentence=result.worst_sentence.model_dump(),
            suggested_rewrite=result.suggested_rewrite,
            retry_challenge=result.retry_challenge,
            model=get_settings().gemini_eval_model,
            raw_response=result.model_dump(),
        )
    )
    # Deterministic metrics for the communication twin / analytics.
    duration = float(attempt.duration_seconds) if attempt.duration_seconds else None
    metrics = compute_metrics(transcript.full_text, duration, transcript.segments)
    db.add(
        CommunicationMetric(attempt_id=attempt.id, user_id=attempt.user_id, **metrics)
    )

    attempt.status = "complete"
    await db.commit()

    # Store this attempt as a memory for future personalization (best-effort).
    try:
        summary = _memory_summary(challenge, result, overall, metrics, stage_names)
        await store_memory(db, attempt.user_id, attempt.id, summary)
    except Exception:
        logger.exception("Failed to store memory for attempt %s", attempt_id)


def _memory_summary(challenge, result, overall, metrics, stage_names) -> str:
    from datetime import UTC, datetime

    stages = " ".join(f"{s}={getattr(result, s).score:.1f}" for s in stage_names)
    detections = ", ".join(result.detections) if result.detections else "none"
    weakness = result.weaknesses[0] if result.weaknesses else ""
    extra = ""
    if metrics.get("wpm"):
        extra = f" wpm={metrics['wpm']} filler_rate={metrics.get('filler_rate')}"
    return (
        f"[{datetime.now(UTC):%Y-%m-%d}] {challenge.title} ({challenge.mode}): "
        f"overall {overall}/10 ({stages}). Weakness: {weakness}. "
        f"Detections: {detections}.{extra}"
    )


async def _call_gemini(
    challenge: Challenge,
    profile: Profile | None,
    transcript_text: str,
    attempt: Attempt,
    is_roleplay: bool = False,
    history: list[str] | None = None,
) -> EvaluationResult | RoleplayEvaluationResult:
    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)
    if is_roleplay:
        system, schema = ROLEPLAY_RUBRIC, RoleplayEvaluationResult
        prompt = build_roleplay_prompt(challenge, profile, transcript_text, history)
    else:
        duration = float(attempt.duration_seconds) if attempt.duration_seconds else None
        system, schema = BASE_RUBRIC, EvaluationResult
        prompt = build_evaluation_prompt(challenge, profile, transcript_text, duration, history)
    response = await client.aio.models.generate_content(
        model=settings.gemini_eval_model,
        contents=prompt,
        config={
            "system_instruction": system,
            "response_mime_type": "application/json",
            "response_schema": schema,
            "temperature": 0.3,
        },
    )
    parsed = response.parsed
    if not isinstance(parsed, schema):
        raise ValueError(f"Gemini returned unparseable evaluation: {response.text[:200]}")
    return parsed
