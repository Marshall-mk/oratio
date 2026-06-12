"""Three-stage evaluation pipeline: transcript → Gemini structured output → DB."""

import logging
import uuid

from google import genai
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session_factory
from app.models import Attempt, Challenge, FeedbackReport, Profile, Score, Session, Transcript
from app.schemas.evaluation import EvaluationResult, StageEvaluation
from app.services.prompts import BASE_RUBRIC, build_evaluation_prompt

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

    result = await _call_gemini(challenge, profile, transcript.full_text, attempt)

    for stage_name in ("thought", "structure", "delivery"):
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

    overall = round((result.thought.score + result.structure.score + result.delivery.score) / 3, 1)
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
    attempt.status = "complete"
    await db.commit()


async def _call_gemini(
    challenge: Challenge,
    profile: Profile | None,
    transcript_text: str,
    attempt: Attempt,
) -> EvaluationResult:
    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)
    duration = float(attempt.duration_seconds) if attempt.duration_seconds else None
    response = await client.aio.models.generate_content(
        model=settings.gemini_eval_model,
        contents=build_evaluation_prompt(challenge, profile, transcript_text, duration),
        config={
            "system_instruction": BASE_RUBRIC,
            "response_mime_type": "application/json",
            "response_schema": EvaluationResult,
            "temperature": 0.3,
        },
    )
    parsed = response.parsed
    if not isinstance(parsed, EvaluationResult):
        raise ValueError(f"Gemini returned unparseable evaluation: {response.text[:200]}")
    return parsed
