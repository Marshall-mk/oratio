from datetime import datetime

from pydantic import BaseModel


class SessionCreate(BaseModel):
    challenge_id: str


class SessionOut(BaseModel):
    id: str
    challenge_id: str
    started_at: datetime


class AttemptOut(BaseModel):
    id: str
    session_id: str
    attempt_number: int
    status: str
    transcription_mode: str
    duration_seconds: float | None
    created_at: datetime


class AttemptCompleteIn(BaseModel):
    duration_seconds: float | None = None
    storage_path: str | None = None  # set when the WAV upload succeeded
    size_bytes: int | None = None


class TranscriptOut(BaseModel):
    full_text: str
    word_count: int | None
    source: str


class StageScoreOut(BaseModel):
    stage: str
    score: float
    dimensions: list[dict]
    summary: str | None


class FeedbackReportOut(BaseModel):
    overall_score: float
    diagnosis: str
    strengths: list
    weaknesses: list
    best_sentence: dict | None
    worst_sentence: dict | None
    suggested_rewrite: str | None
    retry_challenge: str | None
    detections: list[str] = []


class AttemptDetailOut(AttemptOut):
    transcript: TranscriptOut | None = None
    scores: list[StageScoreOut] = []
    report: FeedbackReportOut | None = None
    audio_storage_path: str | None = None
    # Stage scores of the previous attempt in the same session (compare view).
    previous_scores: list[StageScoreOut] = []
