import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CommunicationMetric(Base):
    __tablename__ = "communication_metrics"

    attempt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    words: Mapped[int | None] = mapped_column(Integer)
    duration_seconds: Mapped[float | None] = mapped_column(Numeric)
    wpm: Mapped[float | None] = mapped_column(Numeric)
    unique_words: Mapped[int | None] = mapped_column(Integer)
    unique_ratio: Mapped[float | None] = mapped_column(Numeric)
    avg_sentence_length: Mapped[float | None] = mapped_column(Numeric)
    filler_count: Mapped[int | None] = mapped_column(Integer)
    filler_rate: Mapped[float | None] = mapped_column(Numeric)
    question_count: Mapped[int | None] = mapped_column(Integer)
    reading_ease: Mapped[float | None] = mapped_column(Numeric)
    long_pause_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
