import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import Attempt, Challenge, FeedbackReport, Score, Session, TextExercise

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


class ProgressOut(BaseModel):
    total_attempts: int
    total_speaking_seconds: float
    communication_iq: float | None  # mean of stage averages, 0-100 scale
    stages: list[StageSeries]
    recent_attempts: list[AttemptSummary]


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
        stages=stages,
        recent_attempts=recent,
    )
