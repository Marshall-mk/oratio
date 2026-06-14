"""Debate Arena: generate motions and judge/rank a group debate."""

import uuid

from google import genai
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Debate, DebateTurn
from app.services.gemini_config import resolve_for_user


class Motions(BaseModel):
    motions: list[str] = Field(min_length=3, max_length=3, description="Debate motions, each 'This house...'")


class Ranking(BaseModel):
    name: str
    rank: int = Field(description="1 = best")
    score: float = Field(ge=1.0, le=10.0)
    critique: str = Field(description="One sentence on their performance")


class DebateResult(BaseModel):
    winner: str = Field(description="Name of the winning participant")
    rationale: str = Field(description="1-2 sentences on why they won")
    winning_side: str | None = Field(default=None, description="'For' or 'Against' (sides format only)")
    rankings: list[Ranking]


FORMAT_RUBRIC = {
    "ranked": "Each speaker argued the motion. Rank them by overall argument quality "
    "(logic, evidence, persuasion, clarity). The best speaker wins.",
    "sides": "This is a For-vs-Against debate. Weigh the two sides, decide the winning "
    "side, and within that pick the strongest overall speaker as the winner. Set winning_side.",
    "rebuttal": "Each speaker gave an opening and then a rebuttal. Reward those who "
    "directly engaged and dismantled others' points, not just restated their own.",
}


async def generate_motions(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    cfg = await resolve_for_user(db, user_id)
    client = genai.Client(api_key=cfg.api_key)
    resp = await client.aio.models.generate_content(
        model=cfg.eval_model,
        contents=(
            "Generate 3 fun, debatable motions for a group of friends to argue. Mix light "
            "and serious. Each phrased as 'This house believes ...'. Keep them punchy."
        ),
        config={"response_mime_type": "application/json", "response_schema": Motions, "temperature": 1.0},
    )
    parsed = resp.parsed
    if not isinstance(parsed, Motions):
        raise ValueError("motion generation failed")
    return parsed.motions


async def rank_debate(db: AsyncSession, debate: Debate) -> DebateResult:
    cfg = await resolve_for_user(db, debate.user_id)
    turns = (
        (
            await db.execute(
                select(DebateTurn)
                .where(DebateTurn.debate_id == debate.id)
                .order_by(DebateTurn.round, DebateTurn.created_at)
            )
        )
        .scalars()
        .all()
    )
    sides = {p["name"]: p.get("side") for p in (debate.participants or [])}

    transcript_block = []
    for t in turns:
        side = sides.get(t.participant)
        tag = f" ({side})" if side else ""
        label = f"{t.participant}{tag} — round {t.round}"
        transcript_block.append(f'{label}:\n"""\n{t.transcript or "(silence)"}\n"""')

    system = (
        "You are an impartial debate judge. Be fair and decisive. "
        + FORMAT_RUBRIC.get(debate.format, FORMAT_RUBRIC["ranked"])
        + " Give every participant a score (1-10) and a one-sentence critique, assign ranks "
        "(1 = best, no ties), and name a single winner."
    )
    prompt = f"MOTION: {debate.motion}\n\nSPEECHES:\n\n" + "\n\n".join(transcript_block)

    client = genai.Client(api_key=cfg.api_key)
    resp = await client.aio.models.generate_content(
        model=cfg.eval_model,
        contents=prompt,
        config={
            "system_instruction": system,
            "response_mime_type": "application/json",
            "response_schema": DebateResult,
            "temperature": 0.3,
        },
    )
    parsed = resp.parsed
    if not isinstance(parsed, DebateResult):
        raise ValueError("debate ranking failed")
    return parsed
