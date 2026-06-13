"""Text Lab generation + scoring: reading packs and vocabulary drills."""

import logging
import uuid

from google import genai
from google.genai import types

from app.config import get_settings
from app.db import get_session_factory
from app.models import TextExercise
from app.schemas.text_lab import ReadingPack, VocabResult

logger = logging.getLogger(__name__)

READING_SYSTEM = """\
You are Veritas, a reading-comprehension coach. Given a source text, produce a
study pack that builds genuine understanding: a tight summary, the key terms a
reader must know (with plain-language meanings), the central ideas, an argument
map (each major claim with its support), and a multiple-choice quiz that tests
comprehension and inference (not trivia). Each quiz question has 3-4 options,
exactly one correct, and a one-sentence explanation. Questions must be
answerable from the text and genuinely discriminating."""

VOCAB_GOALS = {
    "word_upgrade": "Upgrade weak or vague words to precise, vivid ones without changing meaning.",
    "sentence_upgrade": "Rewrite the sentence(s) to be clearer, tighter, and more impactful.",
    "academic_rewrite": "Rewrite in precise, formal academic register suitable for a paper.",
    "professional_rewrite": "Rewrite in clear, confident professional/business register.",
    "persuasive_rewrite": "Rewrite to be more persuasive and rhetorically compelling.",
    "simplify": "Rewrite so a smart 12-year-old understands it, without losing the substance.",
}


def vocab_system(subtype: str) -> str:
    goal = VOCAB_GOALS.get(subtype, VOCAB_GOALS["sentence_upgrade"])
    return (
        "You are Veritas, a vocabulary and expression coach. The user submits their "
        f"own text. Goal: {goal} Score the user's ORIGINAL text 1-10 for how well it "
        "already meets that goal, produce an improved version, and list the specific "
        "word/phrase changes with a short reason each. Be concrete and encouraging."
    )


async def extract_pdf_text(pdf_base64: str) -> str:
    import base64

    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)
    resp = await client.aio.models.generate_content(
        model=settings.gemini_eval_model,
        contents=[
            types.Part.from_bytes(
                data=base64.b64decode(pdf_base64), mime_type="application/pdf"
            ),
            "Extract all readable body text from this document verbatim. "
            "Skip page numbers, headers, and footers. Output only the text.",
        ],
    )
    return (resp.text or "").strip()


async def generate_reading_pack(exercise_id: uuid.UUID) -> None:
    """Background task: generate the reading study pack + quiz."""
    factory = get_session_factory()
    async with factory() as db:
        ex = await db.get(TextExercise, exercise_id)
        if ex is None or ex.status != "generating":
            return
        try:
            settings = get_settings()
            client = genai.Client(api_key=settings.gemini_api_key)
            contents: list = [f"SOURCE TEXT:\n\"\"\"\n{ex.source_text}\n\"\"\""]
            resp = await client.aio.models.generate_content(
                model=settings.gemini_eval_model,
                contents=contents,
                config={
                    "system_instruction": READING_SYSTEM,
                    "response_mime_type": "application/json",
                    "response_schema": ReadingPack,
                    "temperature": 0.3,
                },
            )
            pack = resp.parsed
            if not isinstance(pack, ReadingPack):
                raise ValueError("unparseable reading pack")
            # Strip the answer key before storing what the client will see.
            ex.content = {
                "summary": pack.summary,
                "definitions": [d.model_dump() for d in pack.definitions],
                "key_ideas": pack.key_ideas,
                "argument_map": [a.model_dump() for a in pack.argument_map],
                "quiz": [
                    {"question": q.question, "options": q.options} for q in pack.quiz
                ],
            }
            # Keep the answer key server-side in feedback (not exposed until scored).
            ex.feedback = {
                "answer_key": [
                    {"correct_index": q.correct_index, "explanation": q.explanation}
                    for q in pack.quiz
                ]
            }
            ex.status = "ready"
            await db.commit()
        except Exception:
            logger.exception("Reading pack generation failed for %s", exercise_id)
            await db.rollback()
            ex = await db.get(TextExercise, exercise_id)
            if ex:
                ex.status = "failed"
                await db.commit()


def score_reading(answers: list[int], answer_key: list[dict]) -> tuple[float, dict]:
    n = len(answer_key)
    correct = sum(
        1 for i, a in enumerate(answers[:n]) if a == answer_key[i]["correct_index"]
    )
    score = round(1 + 9 * correct / n, 1) if n else 1.0  # map 0%→1.0, 100%→10.0
    feedback = {
        "correct": correct,
        "total": n,
        "per_question": [
            {
                "your_answer": answers[i] if i < len(answers) else None,
                "correct_index": answer_key[i]["correct_index"],
                "explanation": answer_key[i]["explanation"],
                "is_correct": i < len(answers) and answers[i] == answer_key[i]["correct_index"],
            }
            for i in range(n)
        ],
    }
    return score, feedback


async def run_vocabulary(subtype: str, source_text: str) -> VocabResult:
    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)
    resp = await client.aio.models.generate_content(
        model=settings.gemini_eval_model,
        contents=f'USER TEXT:\n"""\n{source_text}\n"""',
        config={
            "system_instruction": vocab_system(subtype),
            "response_mime_type": "application/json",
            "response_schema": VocabResult,
            "temperature": 0.4,
        },
    )
    result = resp.parsed
    if not isinstance(result, VocabResult):
        raise ValueError("unparseable vocab result")
    return result
