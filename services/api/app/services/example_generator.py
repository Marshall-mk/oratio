"""AI-generate a model example answer for a drill, on demand.

Powers the "Show example" button: produces a strong, natural spoken response to
the drill so the user can see what good looks like before they attempt it.
Personalized to the user's profile and framework-aware. Nothing is persisted.
"""

import uuid

from google import genai
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Challenge, Profile
from app.services.gemini_config import resolve_for_user
from app.services.prompts import speaker_context

FRAMEWORK_DESC = {
    "prep": "PREP (Point, Reason, Example, Point)",
    "star": "STAR (Situation, Task, Action, Result)",
    "scientific": "Scientific (Problem, Gap, Method, Result, Impact)",
    "story": "Story arc (Context, Conflict, Resolution, Lesson)",
    "pyramid": "Pyramid Principle (conclusion first, supporting evidence after)",
}


def _example_instruction(challenge: Challenge, profile: Profile | None) -> str:
    secs = challenge.max_speak_seconds
    words = max(40, int(secs * 2.2))  # ~130 words/min of natural speech
    parts = [
        "You are ōrātiō, an expert communication coach. Demonstrate a model spoken "
        "answer to the practice drill below — the kind of strong, natural response a "
        "skilled speaker would deliver out loud.",
        "",
        f"DRILL ({challenge.category}, {challenge.difficulty}): {challenge.title}",
        f"TASK GIVEN TO THE SPEAKER: {challenge.prompt}",
    ]
    if challenge.framework:
        parts.append(
            f"Follow the {FRAMEWORK_DESC.get(challenge.framework, challenge.framework)} "
            "framework clearly, so each part of it is recognizable in the example."
        )
    if challenge.mode == "roleplay":
        persona = challenge.persona or {}
        parts.append(
            f"This is a live roleplay with {persona.get('name', 'a persona')}. Show a "
            "strong OPENING reply the user could give to start the conversation well."
        )
    who = speaker_context(profile)
    if who:
        parts += ["", who, "Tailor the example to this person where it is natural to."]
    parts += [
        "",
        f"Write ONLY the spoken response itself, in the first person, around {words} words "
        f"(≈{secs}s of speech). No preamble, headings, labels, stage directions, or "
        "commentary — output exactly what the speaker would say, nothing else.",
    ]
    return "\n".join(parts)


async def generate_example(db: AsyncSession, user_id: uuid.UUID, challenge: Challenge) -> str:
    cfg = await resolve_for_user(db, user_id)
    profile = await db.get(Profile, user_id)
    client = genai.Client(api_key=cfg.api_key)
    resp = await client.aio.models.generate_content(
        model=cfg.eval_model,
        contents=_example_instruction(challenge, profile),
        config={"temperature": 0.9},
    )
    text = (resp.text or "").strip()
    if not text:
        raise ValueError("Example generation returned no result")
    return text
