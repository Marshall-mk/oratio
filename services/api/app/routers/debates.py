import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import Debate, DebateTurn
from app.services.debate import generate_motions, rank_debate

router = APIRouter(prefix="/debates", tags=["debates"])


class Participant(BaseModel):
    name: str
    side: str | None = None  # 'For' | 'Against' (sides format)


class DebateCreate(BaseModel):
    motion: str
    format: str  # ranked | sides | rebuttal
    participants: list[Participant]


class TurnOut(BaseModel):
    participant: str
    round: int
    transcript: str


class DebateOut(BaseModel):
    id: str
    motion: str
    format: str
    participants: list[Participant]
    status: str
    result: dict | None
    turns: list[TurnOut]


def _out(d: Debate, turns: list[DebateTurn]) -> DebateOut:
    return DebateOut(
        id=str(d.id),
        motion=d.motion,
        format=d.format,
        participants=[Participant(**p) for p in (d.participants or [])],
        status=d.status,
        result=d.result,
        turns=[TurnOut(participant=t.participant, round=t.round, transcript=t.transcript) for t in turns],
    )


@router.post("/motions", response_model=list[str])
async def motions(user: CurrentUser, db: DbSession) -> list[str]:
    try:
        return await generate_motions(db, uuid.UUID(user.id))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Couldn't generate motions: {exc}") from exc


@router.post("", response_model=DebateOut)
async def create_debate(body: DebateCreate, user: CurrentUser, db: DbSession) -> DebateOut:
    if body.format not in ("ranked", "sides", "rebuttal"):
        raise HTTPException(status_code=422, detail="Unknown format")
    if len(body.participants) < 2:
        raise HTTPException(status_code=422, detail="Need at least two participants")
    debate = Debate(
        id=uuid.uuid4(),
        user_id=uuid.UUID(user.id),
        motion=body.motion.strip(),
        format=body.format,
        participants=[p.model_dump() for p in body.participants],
        status="in_progress",
    )
    db.add(debate)
    await db.commit()
    await db.refresh(debate)
    return _out(debate, [])


async def _owned(db: DbSession, user_id: str, debate_id: uuid.UUID) -> Debate:
    d = (
        await db.execute(
            select(Debate).where(Debate.id == debate_id, Debate.user_id == uuid.UUID(user_id))
        )
    ).scalar_one_or_none()
    if d is None:
        raise HTTPException(status_code=404, detail="Debate not found")
    return d


@router.get("/{debate_id}", response_model=DebateOut)
async def get_debate(debate_id: uuid.UUID, user: CurrentUser, db: DbSession) -> DebateOut:
    d = await _owned(db, user.id, debate_id)
    turns = (
        (await db.execute(select(DebateTurn).where(DebateTurn.debate_id == debate_id).order_by(DebateTurn.created_at)))
        .scalars()
        .all()
    )
    return _out(d, turns)


@router.post("/{debate_id}/rank", response_model=DebateOut)
async def rank(debate_id: uuid.UUID, user: CurrentUser, db: DbSession) -> DebateOut:
    d = await _owned(db, user.id, debate_id)
    try:
        result = await rank_debate(db, d)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Couldn't judge the debate: {exc}") from exc
    d.result = result.model_dump()
    d.status = "complete"
    await db.commit()
    await db.refresh(d)
    turns = (
        (await db.execute(select(DebateTurn).where(DebateTurn.debate_id == debate_id).order_by(DebateTurn.created_at)))
        .scalars()
        .all()
    )
    return _out(d, turns)
