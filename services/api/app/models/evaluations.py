import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Score(Base):
    __tablename__ = "scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    attempt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("attempts.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    stage: Mapped[str] = mapped_column(Text)  # thought | structure | delivery
    score: Mapped[float] = mapped_column(Numeric(3, 1))
    dimensions: Mapped[list] = mapped_column(JSONB, default=list)
    summary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FeedbackReport(Base):
    __tablename__ = "feedback_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attempts.id"), unique=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    overall_score: Mapped[float] = mapped_column(Numeric(3, 1))
    diagnosis: Mapped[str] = mapped_column(Text)
    strengths: Mapped[list] = mapped_column(JSONB, default=list)
    weaknesses: Mapped[list] = mapped_column(JSONB, default=list)
    best_sentence: Mapped[dict | None] = mapped_column(JSONB)
    worst_sentence: Mapped[dict | None] = mapped_column(JSONB)
    suggested_rewrite: Mapped[str | None] = mapped_column(Text)
    retry_challenge: Mapped[str | None] = mapped_column(Text)
    model: Mapped[str] = mapped_column(Text)
    raw_response: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
