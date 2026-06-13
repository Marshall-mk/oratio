import asyncio
import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import TextExercise
from app.schemas.text_lab import (
    ReadingCreate,
    ReadingSubmit,
    TextExerciseOut,
    VocabularyCreate,
)
from app.services.text_lab import (
    extract_pdf_text,
    generate_reading_pack,
    run_vocabulary,
    score_reading,
)

router = APIRouter(tags=["text-lab"])

VOCAB_SUBTYPES = {
    "word_upgrade",
    "sentence_upgrade",
    "academic_rewrite",
    "professional_rewrite",
    "persuasive_rewrite",
    "simplify",
}


def _out(ex: TextExercise, *, hide_answers: bool = True) -> TextExerciseOut:
    # The answer key lives in feedback while status='ready'; never leak it pre-submit.
    feedback = ex.feedback
    if hide_answers and ex.status == "ready" and ex.kind == "reading":
        feedback = None
    return TextExerciseOut(
        id=str(ex.id),
        kind=ex.kind,
        subtype=ex.subtype,
        source_title=ex.source_title,
        source_text=ex.source_text,
        content=ex.content,
        submission=ex.submission,
        score=float(ex.score) if ex.score is not None else None,
        feedback=feedback,
        status=ex.status,
        created_at=ex.created_at.isoformat(),
    )


async def _owned(db: DbSession, user_id: str, ex_id: uuid.UUID) -> TextExercise:
    ex = (
        await db.execute(
            select(TextExercise).where(
                TextExercise.id == ex_id, TextExercise.user_id == uuid.UUID(user_id)
            )
        )
    ).scalar_one_or_none()
    if ex is None:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return ex


@router.post("/reading", response_model=TextExerciseOut)
async def create_reading(body: ReadingCreate, user: CurrentUser, db: DbSession) -> TextExerciseOut:
    source_text = (body.source_text or "").strip()
    if not source_text and body.pdf_base64:
        try:
            source_text = await extract_pdf_text(body.pdf_base64)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"PDF extraction failed: {exc}") from exc
    if len(source_text) < 100:
        raise HTTPException(status_code=422, detail="Provide at least a paragraph of text")

    ex = TextExercise(
        id=uuid.uuid4(),
        user_id=uuid.UUID(user.id),
        kind="reading",
        subtype="comprehension",
        source_title=body.source_title,
        source_text=source_text,
        status="generating",
    )
    db.add(ex)
    await db.commit()
    await db.refresh(ex)
    asyncio.create_task(generate_reading_pack(ex.id))
    return _out(ex)


@router.post("/reading/{exercise_id}/submit", response_model=TextExerciseOut)
async def submit_reading(
    exercise_id: uuid.UUID, body: ReadingSubmit, user: CurrentUser, db: DbSession
) -> TextExerciseOut:
    ex = await _owned(db, user.id, exercise_id)
    if ex.status != "ready":
        raise HTTPException(status_code=409, detail=f"Exercise is {ex.status}")
    answer_key = (ex.feedback or {}).get("answer_key", [])
    score, result = score_reading(body.answers, answer_key)
    ex.submission = {"answers": body.answers}
    ex.score = score
    ex.feedback = result  # replaces the stored key with graded feedback
    ex.status = "scored"
    await db.commit()
    await db.refresh(ex)
    return _out(ex, hide_answers=False)


@router.post("/vocabulary", response_model=TextExerciseOut)
async def create_vocabulary(
    body: VocabularyCreate, user: CurrentUser, db: DbSession
) -> TextExerciseOut:
    if body.subtype not in VOCAB_SUBTYPES:
        raise HTTPException(status_code=422, detail="Unknown vocabulary drill")
    text = body.source_text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Enter some text")
    try:
        result = await run_vocabulary(body.subtype, text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Vocabulary scoring failed: {exc}") from exc

    ex = TextExercise(
        id=uuid.uuid4(),
        user_id=uuid.UUID(user.id),
        kind="vocabulary",
        subtype=body.subtype,
        source_text=text,
        content={"improved": result.improved, "changes": [c.model_dump() for c in result.changes]},
        score=round(result.vocabulary_score, 1),
        feedback={"feedback": result.feedback},
        status="scored",
    )
    db.add(ex)
    await db.commit()
    await db.refresh(ex)
    return _out(ex, hide_answers=False)


@router.get("/text-exercises/{exercise_id}", response_model=TextExerciseOut)
async def get_exercise(
    exercise_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> TextExerciseOut:
    ex = await _owned(db, user.id, exercise_id)
    return _out(ex)


@router.get("/me/text-exercises", response_model=list[TextExerciseOut])
async def list_exercises(
    user: CurrentUser, db: DbSession, kind: str | None = None
) -> list[TextExerciseOut]:
    query = (
        select(TextExercise)
        .where(TextExercise.user_id == uuid.UUID(user.id))
        .order_by(TextExercise.created_at.desc())
        .limit(50)
    )
    if kind:
        query = query.where(TextExercise.kind == kind)
    rows = (await db.execute(query)).scalars().all()
    return [_out(e) for e in rows]
