import asyncio
import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession
from app.models import Attempt, AudioFile, Challenge, FeedbackReport, Score, Session, Transcript
from app.services.evaluator import run_evaluation
from app.schemas.sessions import (
    AttemptCompleteIn,
    AttemptDetailOut,
    AttemptOut,
    FeedbackReportOut,
    SessionCreate,
    SessionOut,
    StageScoreOut,
    TranscriptOut,
)

router = APIRouter(tags=["sessions"])


def _attempt_out(a: Attempt) -> AttemptOut:
    return AttemptOut(
        id=str(a.id),
        session_id=str(a.session_id),
        attempt_number=a.attempt_number,
        status=a.status,
        transcription_mode=a.transcription_mode,
        duration_seconds=float(a.duration_seconds) if a.duration_seconds is not None else None,
        created_at=a.created_at,
    )


async def _owned_attempt(db: DbSession, user_id: str, attempt_id: uuid.UUID) -> Attempt:
    result = await db.execute(
        select(Attempt).where(Attempt.id == attempt_id, Attempt.user_id == uuid.UUID(user_id))
    )
    attempt = result.scalar_one_or_none()
    if attempt is None:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return attempt


@router.post("/sessions", response_model=SessionOut)
async def create_session(body: SessionCreate, user: CurrentUser, db: DbSession) -> SessionOut:
    challenge = (
        await db.execute(select(Challenge).where(Challenge.id == uuid.UUID(body.challenge_id)))
    ).scalar_one_or_none()
    if challenge is None:
        raise HTTPException(status_code=404, detail="Challenge not found")
    session = Session(
        id=uuid.uuid4(), user_id=uuid.UUID(user.id), challenge_id=challenge.id
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionOut(
        id=str(session.id), challenge_id=str(session.challenge_id), started_at=session.started_at
    )


@router.post("/sessions/{session_id}/attempts", response_model=AttemptOut)
async def create_attempt(session_id: uuid.UUID, user: CurrentUser, db: DbSession) -> AttemptOut:
    session = (
        await db.execute(
            select(Session).where(
                Session.id == session_id, Session.user_id == uuid.UUID(user.id)
            )
        )
    ).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    next_number = (
        await db.execute(
            select(func.coalesce(func.max(Attempt.attempt_number), 0) + 1).where(
                Attempt.session_id == session_id
            )
        )
    ).scalar_one()

    attempt = Attempt(
        id=uuid.uuid4(),
        session_id=session_id,
        user_id=uuid.UUID(user.id),
        attempt_number=next_number,
        status="recording",
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return _attempt_out(attempt)


@router.get("/attempts/{attempt_id}", response_model=AttemptDetailOut)
async def get_attempt(attempt_id: uuid.UUID, user: CurrentUser, db: DbSession) -> AttemptDetailOut:
    attempt = await _owned_attempt(db, user.id, attempt_id)
    transcript = (
        await db.execute(select(Transcript).where(Transcript.attempt_id == attempt_id))
    ).scalar_one_or_none()
    out = AttemptDetailOut(**_attempt_out(attempt).model_dump())
    if transcript:
        out.transcript = TranscriptOut(
            full_text=transcript.full_text,
            word_count=transcript.word_count,
            source=transcript.source,
        )

    scores = (
        (await db.execute(select(Score).where(Score.attempt_id == attempt_id))).scalars().all()
    )
    out.scores = [
        StageScoreOut(
            stage=s.stage, score=float(s.score), dimensions=s.dimensions, summary=s.summary
        )
        for s in scores
    ]
    report = (
        await db.execute(select(FeedbackReport).where(FeedbackReport.attempt_id == attempt_id))
    ).scalar_one_or_none()
    if report:
        out.report = FeedbackReportOut(
            overall_score=float(report.overall_score),
            diagnosis=report.diagnosis,
            strengths=report.strengths,
            weaknesses=report.weaknesses,
            best_sentence=report.best_sentence,
            worst_sentence=report.worst_sentence,
            suggested_rewrite=report.suggested_rewrite,
            retry_challenge=report.retry_challenge,
            detections=(report.raw_response or {}).get("detections", []),
        )
    audio = (
        await db.execute(select(AudioFile).where(AudioFile.attempt_id == attempt_id))
    ).scalar_one_or_none()
    if audio:
        out.audio_storage_path = audio.storage_path

    if attempt.attempt_number > 1:
        prev = (
            await db.execute(
                select(Attempt).where(
                    Attempt.session_id == attempt.session_id,
                    Attempt.attempt_number == attempt.attempt_number - 1,
                )
            )
        ).scalar_one_or_none()
        if prev is not None:
            prev_scores = (
                (await db.execute(select(Score).where(Score.attempt_id == prev.id)))
                .scalars()
                .all()
            )
            out.previous_scores = [
                StageScoreOut(
                    stage=s.stage, score=float(s.score), dimensions=s.dimensions, summary=s.summary
                )
                for s in prev_scores
            ]
    return out


@router.post("/attempts/{attempt_id}/complete", response_model=AttemptOut)
async def complete_attempt(
    attempt_id: uuid.UUID, body: AttemptCompleteIn, user: CurrentUser, db: DbSession
) -> AttemptOut:
    attempt = await _owned_attempt(db, user.id, attempt_id)
    if attempt.status not in ("recording", "uploaded"):
        raise HTTPException(status_code=409, detail=f"Attempt is {attempt.status}")

    if body.duration_seconds is not None:
        attempt.duration_seconds = body.duration_seconds

    if body.storage_path:
        db.add(
            AudioFile(
                id=uuid.uuid4(),
                attempt_id=attempt.id,
                user_id=attempt.user_id,
                storage_path=body.storage_path,
                size_bytes=body.size_bytes,
                duration_seconds=body.duration_seconds,
            )
        )

    transcript = (
        await db.execute(select(Transcript).where(Transcript.attempt_id == attempt_id))
    ).scalar_one_or_none()
    if transcript is None:
        raise HTTPException(
            status_code=409,
            detail="No transcript yet — use /transcribe-fallback if the live path failed",
        )

    attempt.status = "evaluating"
    await db.commit()
    await db.refresh(attempt)
    asyncio.create_task(run_evaluation(attempt.id))
    return _attempt_out(attempt)


@router.post("/attempts/{attempt_id}/reevaluate", response_model=AttemptOut)
async def reevaluate_attempt(
    attempt_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> AttemptOut:
    """Re-run evaluation after a failure (e.g. transient Gemini error/quota)."""
    attempt = await _owned_attempt(db, user.id, attempt_id)
    if attempt.status != "failed":
        raise HTTPException(status_code=409, detail=f"Attempt is {attempt.status}, not failed")
    transcript = (
        await db.execute(select(Transcript).where(Transcript.attempt_id == attempt_id))
    ).scalar_one_or_none()
    if transcript is None:
        raise HTTPException(status_code=409, detail="No transcript to evaluate")
    attempt.status = "evaluating"
    await db.commit()
    await db.refresh(attempt)
    asyncio.create_task(run_evaluation(attempt.id))
    return _attempt_out(attempt)


@router.post("/attempts/{attempt_id}/transcribe-fallback", response_model=AttemptOut)
async def transcribe_fallback(
    attempt_id: uuid.UUID, body: AttemptCompleteIn, user: CurrentUser, db: DbSession
) -> AttemptOut:
    """Record-then-upload path when the live WebSocket failed mid-take."""
    from app.services.batch_transcribe import transcribe_wav
    from app.services.storage import download_recording

    attempt = await _owned_attempt(db, user.id, attempt_id)
    existing = (
        await db.execute(select(Transcript).where(Transcript.attempt_id == attempt_id))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Transcript already exists")
    if not body.storage_path:
        raise HTTPException(status_code=422, detail="storage_path required")

    attempt.status = "transcribing"
    attempt.transcription_mode = "fallback"
    if body.duration_seconds is not None:
        attempt.duration_seconds = body.duration_seconds
    db.add(
        AudioFile(
            id=uuid.uuid4(),
            attempt_id=attempt.id,
            user_id=attempt.user_id,
            storage_path=body.storage_path,
            size_bytes=body.size_bytes,
            duration_seconds=body.duration_seconds,
        )
    )
    await db.commit()

    try:
        from app.services.gemini_config import resolve_for_user

        cfg = await resolve_for_user(db, user.id)
        wav = await download_recording(body.storage_path)
        full_text = await transcribe_wav(wav, cfg.api_key, cfg.eval_model)
    except Exception as exc:
        attempt.status = "failed"
        await db.commit()
        raise HTTPException(status_code=502, detail=f"Transcription failed: {exc}") from exc

    db.add(
        Transcript(
            id=uuid.uuid4(),
            attempt_id=attempt.id,
            user_id=attempt.user_id,
            full_text=full_text,
            segments=[],
            word_count=len(full_text.split()),
            source="gemini_batch",
        )
    )
    attempt.status = "evaluating"
    await db.commit()
    await db.refresh(attempt)
    asyncio.create_task(run_evaluation(attempt.id))
    return _attempt_out(attempt)
