"""Evaluation pipeline tests.

Offline tests always run. The golden-transcript test calls the real Gemini API
and is opt-in:  RUN_LIVE_EVAL=1 uv run pytest tests/test_evaluation.py -k golden
"""

import os
import uuid

import pytest

from app.models import Challenge, Profile
from app.schemas.evaluation import EvaluationResult
from app.services.prompts import BASE_RUBRIC, build_evaluation_prompt
from tests.fixtures import RAMBLING_TRANSCRIPT, STRONG_TRANSCRIPT


def make_challenge(**overrides) -> Challenge:
    defaults = dict(
        id=uuid.uuid4(),
        slug="idea-hospital-ai",
        title="Idea Expansion: AI in Hospitals",
        prompt="Why should hospitals invest in AI diagnostics?",
        category="thought",
        framework=None,
        difficulty="intermediate",
        prep_seconds=30,
        max_speak_seconds=150,
        evaluation_focus={"thought": {"evidence": 1.5}},
        tags=["idea-expansion"],
        is_active=True,
    )
    defaults.update(overrides)
    return Challenge(**defaults)


def test_prompt_includes_challenge_and_profile():
    challenge = make_challenge()
    profile = Profile(
        user_id=uuid.uuid4(),
        profession="ML researcher",
        industry="Healthcare AI",
        goals=["research communication"],
        weaknesses=["rambling"],
        strengths=[],
        primary_use_cases=["research"],
        speaking_confidence=3,
    )
    prompt = build_evaluation_prompt(challenge, profile, STRONG_TRANSCRIPT, 60.0)
    assert "Why should hospitals invest in AI diagnostics?" in prompt
    assert "ML researcher" in prompt
    assert "rambling" in prompt  # self-reported weakness surfaced to evaluator
    assert STRONG_TRANSCRIPT in prompt
    assert "60s" in prompt


def test_prompt_framework_addendum():
    challenge = make_challenge(framework="prep", category="structure")
    prompt = build_evaluation_prompt(challenge, None, STRONG_TRANSCRIPT, None)
    assert "PREP (Point, Reason, Example, Point)" in prompt
    assert "framework adherence" in prompt


def test_rubric_demands_independence_and_artifact_tolerance():
    assert "THREE INDEPENDENT stages" in BASE_RUBRIC
    assert "transcription artifacts" in BASE_RUBRIC


def test_evaluation_schema_rejects_out_of_range_scores():
    with pytest.raises(Exception):
        EvaluationResult.model_validate(
            {
                "thought": {"score": 11.0, "dimensions": [], "summary": "x"},
                "structure": {"score": 5.0, "dimensions": [], "summary": "x"},
                "delivery": {"score": 5.0, "dimensions": [], "summary": "x"},
                "diagnosis": "d",
                "strengths": ["a", "b"],
                "weaknesses": ["a", "b"],
                "best_sentence": {"text": "t", "reason": "r"},
                "worst_sentence": {"text": "t", "reason": "r"},
                "suggested_rewrite": "s",
                "retry_challenge": "r",
            }
        )


@pytest.mark.skipif(not os.environ.get("RUN_LIVE_EVAL"), reason="set RUN_LIVE_EVAL=1 to call Gemini")
@pytest.mark.anyio
async def test_golden_strong_beats_rambling():
    """The evaluator must rank the strong transcript above the rambling one on every stage."""
    from app.models import Attempt
    from app.services.evaluator import _call_gemini

    challenge = make_challenge()
    attempt = Attempt(id=uuid.uuid4(), session_id=uuid.uuid4(), user_id=uuid.uuid4(),
                      attempt_number=1, status="evaluating", duration_seconds=60)

    strong = await _call_gemini(challenge, None, STRONG_TRANSCRIPT, attempt)
    rambling = await _call_gemini(challenge, None, RAMBLING_TRANSCRIPT, attempt)

    for stage in ("thought", "structure", "delivery"):
        s, r = getattr(strong, stage).score, getattr(rambling, stage).score
        assert s > r, f"{stage}: strong {s} should beat rambling {r}"
    assert "rambling" in rambling.detections or "filler_heavy" in rambling.detections
