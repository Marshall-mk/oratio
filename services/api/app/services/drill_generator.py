"""AI-generate a fresh, profile-personalized drill (the 'Random' option).

Each generated drill is saved as a hidden (is_active=false) challenge owned by
the user, so it runs through the normal pipeline. Recent topics per (user,
category, group) are fed back into the prompt so Random never repeats."""

import random
import uuid

from google import genai
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Challenge, Profile
from app.services.gemini_config import resolve_for_user
from app.services.prompts import speaker_context

VOICES = ["Charon", "Kore", "Aoede", "Fenrir", "Orus", "Leda", "Puck"]


class GeneratedPersona(BaseModel):
    name: str
    instruction: str = Field(description="How the AI should stay in character")
    opener: str = Field(description="The persona's first spoken line to open the scene")


class GeneratedDrill(BaseModel):
    title: str = Field(description="Short, specific drill title")
    prompt: str = Field(description="The instruction shown to the speaker")
    topic: str = Field(description="A short unique topic label, for de-duplication")
    persona: GeneratedPersona | None = None  # roleplay scenarios only


# Per-(category, group) generation guidance + the fixed mechanics we set ourselves.
THOUGHT_GUIDE = {
    "idea_expansion": "an Idea Expansion prompt: a debatable question the speaker develops from several distinct angles",
    "argument_builder": "an Argument Builder prompt: a claim to argue with evidence, a counterargument, and a rebuttal",
    "first_principles": "a First Principles prompt: reason a concept up from fundamentals, ideally from the speaker's own field",
    "mental_models": "a Mental Models prompt: explain something complex using a single vivid analogy",
    "thinking_speed": "a punchy Thinking Speed prompt: a provocative question to answer fast with little prep",
}
FRAMEWORK_DESC = {
    "prep": "PREP (Point, Reason, Example, Point)",
    "star": "STAR (Situation, Task, Action, Result)",
    "scientific": "Scientific (Problem, Gap, Method, Result, Impact)",
    "story": "Story arc (Context, Conflict, Resolution, Lesson)",
    "pyramid": "Pyramid Principle (conclusion first, supporting evidence after)",
}


def _instruction(category: str, group: str, profile: Profile | None, avoid: list[str]) -> str:
    who = speaker_context(profile) or "No profile provided."
    avoid_line = (
        "Do NOT reuse or closely resemble any of these recent topics: "
        + "; ".join(avoid)
        if avoid
        else "This is their first one — make it memorable."
    )
    base = (
        "You are oratio, a communication coach creating ONE fresh practice drill, "
        "personalized to this speaker. Be specific and original; pick a surprising, "
        "concrete topic relevant to their profession, goals, and interests.\n\n"
        f"{who}\n\n{avoid_line}\n\n"
    )
    if category == "thought":
        return base + f"Write {THOUGHT_GUIDE.get(group, THOUGHT_GUIDE['idea_expansion'])}."
    if category == "structure":
        return base + (
            f"Write a prompt that naturally requires the {FRAMEWORK_DESC.get(group, group)} "
            "framework — the speaker should have to structure their answer that way."
        )
    if category == "speaking":
        return base + (
            f"Write a {group}-level speaking challenge (e.g. public speaking, interview, "
            "persuasion, teaching, storytelling). One clear spoken task."
        )
    if category == "scenario":
        return base + (
            f"Design a {group}-level live ROLEPLAY scenario. Provide a persona (name, an "
            "instruction telling the AI how to stay in character and react, and a spoken "
            "opener line) plus a one-line situation 'prompt' telling the user their goal. "
            "Make it relevant to their goals/use cases (negotiation, interview, conflict, "
            "networking, relationships, leadership...)."
        )
    return base + "Write a short speaking practice prompt."


def _mechanics(category: str, group: str) -> dict:
    """Fixed fields we control (not left to the model)."""
    if category == "thought":
        fast = group == "thinking_speed"
        return dict(
            subcategory=group, difficulty="intermediate", mode="monologue",
            prep_seconds=10 if fast else 30, max_speak_seconds=60 if fast else 150,
        )
    if category == "structure":
        return dict(
            subcategory=group, framework=group, difficulty="intermediate", mode="monologue",
            prep_seconds=45, max_speak_seconds=150,
        )
    if category == "speaking":
        return dict(difficulty=group, mode="monologue", prep_seconds=30, max_speak_seconds=150)
    if category == "scenario":
        return dict(difficulty=group, mode="roleplay", prep_seconds=15, max_speak_seconds=300)
    return dict(difficulty="intermediate", mode="monologue", prep_seconds=30, max_speak_seconds=150)


def _group_field(category: str):
    return Challenge.difficulty if category in ("scenario", "speaking") else Challenge.subcategory


async def generate_drill(
    db: AsyncSession, user_id: uuid.UUID, category: str, group: str
) -> Challenge:
    cfg = await resolve_for_user(db, user_id)
    profile = await db.get(Profile, user_id)

    avoid_rows = (
        await db.execute(
            select(Challenge.gen_topic)
            .where(
                Challenge.generated_for == user_id,
                Challenge.category == category,
                _group_field(category) == group,
                Challenge.gen_topic.is_not(None),
            )
            .order_by(Challenge.created_at.desc())
            .limit(30)
        )
    ).all()
    avoid = [r[0] for r in avoid_rows]

    client = genai.Client(api_key=cfg.api_key)
    resp = await client.aio.models.generate_content(
        model=cfg.eval_model,
        contents=_instruction(category, group, profile, avoid),
        config={
            "response_mime_type": "application/json",
            "response_schema": GeneratedDrill,
            "temperature": 1.0,  # high for variety
        },
    )
    drill = resp.parsed
    if not isinstance(drill, GeneratedDrill):
        raise ValueError("Drill generation returned no result")

    mech = _mechanics(category, group)
    persona = None
    if mech["mode"] == "roleplay" and drill.persona:
        persona = {
            "name": drill.persona.name,
            "voice": random.choice(VOICES),
            "instruction": drill.persona.instruction,
            "opener": drill.persona.opener,
        }

    challenge = Challenge(
        id=uuid.uuid4(),
        slug=f"gen-{uuid.uuid4().hex[:12]}",
        title=drill.title,
        prompt=drill.prompt,
        category=category,
        evaluation_focus={},
        tags=["generated"],
        is_active=False,
        generated_for=user_id,
        gen_topic=drill.topic,
        persona=persona,
        **mech,
    )
    db.add(challenge)
    await db.commit()
    await db.refresh(challenge)
    return challenge
