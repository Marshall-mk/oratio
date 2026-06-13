import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from collections import Counter, defaultdict

from app.deps import CurrentUser, DbSession
from app.models import (
    Attempt,
    Challenge,
    CommunicationMetric,
    FeedbackReport,
    Score,
    Session,
    TextExercise,
)

router = APIRouter(prefix="/me", tags=["progress"])


class AttemptSummary(BaseModel):
    attempt_id: str
    challenge_title: str
    challenge_category: str
    attempt_number: int
    overall_score: float | None
    stage_scores: dict[str, float]
    created_at: datetime


class StageSeries(BaseModel):
    stage: str
    points: list[float]  # chronological, completed attempts
    average: float | None
    latest: float | None
    delta_vs_first: float | None


class DimensionStat(BaseModel):
    dimension: str
    stage: str
    average: float


class ProgressOut(BaseModel):
    total_attempts: int
    total_speaking_seconds: float
    communication_iq: float | None  # mean of stage averages, 0-100 scale
    iq_delta: float | None  # IQ change vs the speaker's early attempts
    stages: list[StageSeries]
    recent_attempts: list[AttemptSummary]
    advanced_metrics: dict | None  # averaged communication metrics
    detection_counts: dict[str, int]  # how often each anti-pattern appears
    strengths: list[DimensionStat]  # top dimensions across all attempts
    weaknesses: list[DimensionStat]  # bottom dimensions across all attempts


@router.get("/progress", response_model=ProgressOut)
async def get_progress(user: CurrentUser, db: DbSession) -> ProgressOut:
    user_id = uuid.UUID(user.id)

    attempts = (
        (
            await db.execute(
                select(Attempt, Session.challenge_id)
                .join(Session, Attempt.session_id == Session.id)
                .where(Attempt.user_id == user_id, Attempt.status == "complete")
                .order_by(Attempt.created_at)
            )
        )
        .all()
    )
    attempt_ids = [a.Attempt.id for a in attempts]

    scores = (
        (await db.execute(select(Score).where(Score.user_id == user_id))).scalars().all()
        if attempt_ids
        else []
    )
    scores_by_attempt: dict[uuid.UUID, dict[str, float]] = {}
    for s in scores:
        scores_by_attempt.setdefault(s.attempt_id, {})[s.stage] = float(s.score)

    reports = (
        (await db.execute(select(FeedbackReport).where(FeedbackReport.user_id == user_id)))
        .scalars()
        .all()
        if attempt_ids
        else []
    )
    overall_by_attempt = {r.attempt_id: float(r.overall_score) for r in reports}

    challenge_ids = {a.challenge_id for a in attempts}
    challenges = (
        (await db.execute(select(Challenge).where(Challenge.id.in_(challenge_ids)))).scalars().all()
        if challenge_ids
        else []
    )
    challenge_by_id = {c.id: c for c in challenges}

    stages: list[StageSeries] = []
    for stage in ("thought", "structure", "delivery", "social"):
        points = [
            scores_by_attempt[a.Attempt.id][stage]
            for a in attempts
            if stage in scores_by_attempt.get(a.Attempt.id, {})
        ]
        stages.append(
            StageSeries(
                stage=stage,
                points=points,
                average=round(sum(points) / len(points), 1) if points else None,
                latest=points[-1] if points else None,
                delta_vs_first=round(points[-1] - points[0], 1) if len(points) >= 2 else None,
            )
        )

    # Text Lab adds comprehension + vocabulary series from scored text_exercises.
    text_rows = (
        (
            await db.execute(
                select(TextExercise)
                .where(
                    TextExercise.user_id == user_id,
                    TextExercise.status == "scored",
                    TextExercise.score.is_not(None),
                )
                .order_by(TextExercise.created_at)
            )
        )
        .scalars()
        .all()
    )
    for stage_name, kind in (("comprehension", "reading"), ("vocabulary", "vocabulary")):
        points = [float(r.score) for r in text_rows if r.kind == kind]
        stages.append(
            StageSeries(
                stage=stage_name,
                points=points,
                average=round(sum(points) / len(points), 1) if points else None,
                latest=points[-1] if points else None,
                delta_vs_first=round(points[-1] - points[0], 1) if len(points) >= 2 else None,
            )
        )

    averages = [s.average for s in stages if s.average is not None]
    communication_iq = round((sum(averages) / len(averages)) * 10, 0) if averages else None

    # IQ delta: compare mean overall of the first third vs the last third of attempts.
    iq_delta = None
    overalls = [overall_by_attempt[a.Attempt.id] for a in attempts if a.Attempt.id in overall_by_attempt]
    if len(overalls) >= 4:
        third = max(len(overalls) // 3, 1)
        early = sum(overalls[:third]) / third
        late = sum(overalls[-third:]) / third
        iq_delta = round((late - early) * 10, 0)

    # Advanced metrics: averages over the speaker's communication_metrics.
    metric_rows = (
        (await db.execute(select(CommunicationMetric).where(CommunicationMetric.user_id == user_id)))
        .scalars()
        .all()
    )
    advanced_metrics = None
    if metric_rows:
        def _avg(field: str) -> float | None:
            vals = [float(getattr(m, field)) for m in metric_rows if getattr(m, field) is not None]
            return round(sum(vals) / len(vals), 1) if vals else None

        advanced_metrics = {
            "wpm": _avg("wpm"),
            "filler_rate": _avg("filler_rate"),
            "unique_ratio": _avg("unique_ratio"),
            "avg_sentence_length": _avg("avg_sentence_length"),
            "reading_ease": _avg("reading_ease"),
            "questions_per_attempt": _avg("question_count"),
        }

    # Detection frequencies across all feedback reports.
    detection_counter: Counter = Counter()
    for r in reports:
        for d in (r.raw_response or {}).get("detections", []):
            detection_counter[d] += 1

    # Dimension strengths/weaknesses: average score per (stage, dimension).
    dim_totals: dict[tuple[str, str], list[float]] = defaultdict(list)
    for s in scores:
        for d in s.dimensions or []:
            dim_totals[(s.stage, d["dimension"])].append(float(d["score"]))
    dim_stats = [
        DimensionStat(stage=stage, dimension=dim, average=round(sum(v) / len(v), 1))
        for (stage, dim), v in dim_totals.items()
        if len(v) >= 1
    ]
    dim_stats.sort(key=lambda x: x.average, reverse=True)
    strengths = dim_stats[:3]
    weaknesses = sorted(dim_stats, key=lambda x: x.average)[:3]

    recent = [
        AttemptSummary(
            attempt_id=str(a.Attempt.id),
            challenge_title=challenge_by_id[a.challenge_id].title,
            challenge_category=challenge_by_id[a.challenge_id].category,
            attempt_number=a.Attempt.attempt_number,
            overall_score=overall_by_attempt.get(a.Attempt.id),
            stage_scores=scores_by_attempt.get(a.Attempt.id, {}),
            created_at=a.Attempt.created_at,
        )
        for a in reversed(attempts[-20:])
    ]

    return ProgressOut(
        total_attempts=len(attempts),
        total_speaking_seconds=float(
            sum(float(a.Attempt.duration_seconds or 0) for a in attempts)
        ),
        communication_iq=communication_iq,
        iq_delta=iq_delta,
        stages=stages,
        recent_attempts=recent,
        advanced_metrics=advanced_metrics,
        detection_counts=dict(detection_counter),
        strengths=strengths,
        weaknesses=weaknesses,
    )
