"""Structured-output schema for the three-stage evaluation.

Passed directly to Gemini as `response_schema`; also the shape persisted to
`scores` (per stage) and `feedback_reports`.
"""

from pydantic import BaseModel, Field


class DimensionScore(BaseModel):
    dimension: str
    score: float = Field(ge=1.0, le=10.0)
    rationale: str = Field(description="One concrete sentence citing the transcript")


class StageEvaluation(BaseModel):
    score: float = Field(ge=1.0, le=10.0)
    dimensions: list[DimensionScore]
    summary: str = Field(description="2-3 sentences on this stage's performance")


class SentenceFeedback(BaseModel):
    text: str = Field(description="Verbatim sentence from the transcript")
    reason: str


class EvaluationResult(BaseModel):
    thought: StageEvaluation
    structure: StageEvaluation
    delivery: StageEvaluation
    diagnosis: str = Field(
        description=(
            "The single most useful cross-stage insight, e.g. "
            "'Strong ideas are being lost due to poor organization'"
        )
    )
    strengths: list[str] = Field(min_length=2, max_length=4)
    weaknesses: list[str] = Field(min_length=2, max_length=4)
    best_sentence: SentenceFeedback
    worst_sentence: SentenceFeedback
    suggested_rewrite: str = Field(
        description="A rewritten version of the weakest section, in the speaker's voice"
    )
    retry_challenge: str = Field(
        description="One specific, actionable instruction for the next attempt"
    )
    detections: list[str] = Field(
        default_factory=list,
        description=(
            "Communication anti-patterns present in this attempt, from: rambling, "
            "jargon, tangents, defensiveness, weak_arguments, circular_logic, "
            "overexplaining, filler_heavy. Empty list if none."
        ),
    )
