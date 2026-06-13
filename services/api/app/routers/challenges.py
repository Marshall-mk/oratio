import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import Challenge

router = APIRouter(prefix="/challenges", tags=["challenges"])


class ChallengeOut(BaseModel):
    id: str
    slug: str
    title: str
    prompt: str
    category: str
    framework: str | None
    difficulty: str
    prep_seconds: int
    max_speak_seconds: int
    tags: list[str]
    mode: str
    persona_name: str | None = None
    persona_opener: str | None = None


def _to_out(c: Challenge) -> ChallengeOut:
    persona = c.persona or {}
    return ChallengeOut(
        id=str(c.id),
        slug=c.slug,
        title=c.title,
        prompt=c.prompt,
        category=c.category,
        framework=c.framework,
        difficulty=c.difficulty,
        prep_seconds=c.prep_seconds,
        max_speak_seconds=c.max_speak_seconds,
        tags=c.tags or [],
        mode=c.mode,
        persona_name=persona.get("name"),
        persona_opener=persona.get("opener"),
    )


@router.get("", response_model=list[ChallengeOut])
async def list_challenges(
    user: CurrentUser, db: DbSession, category: str | None = None
) -> list[ChallengeOut]:
    query = select(Challenge).where(Challenge.is_active).order_by(Challenge.category, Challenge.difficulty)
    if category:
        query = query.where(Challenge.category == category)
    result = await db.execute(query)
    return [_to_out(c) for c in result.scalars().all()]


@router.get("/{challenge_id}", response_model=ChallengeOut)
async def get_challenge(challenge_id: uuid.UUID, user: CurrentUser, db: DbSession) -> ChallengeOut:
    result = await db.execute(select(Challenge).where(Challenge.id == challenge_id))
    challenge = result.scalar_one_or_none()
    if challenge is None:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return _to_out(challenge)
