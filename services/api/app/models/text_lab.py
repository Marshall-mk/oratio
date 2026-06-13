import uuid
from datetime import datetime

from sqlalchemy import DateTime, Numeric, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TextExercise(Base):
    __tablename__ = "text_exercises"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    kind: Mapped[str] = mapped_column(Text)  # reading | vocabulary
    subtype: Mapped[str] = mapped_column(Text)
    source_title: Mapped[str | None] = mapped_column(Text)
    source_text: Mapped[str] = mapped_column(Text)
    content: Mapped[dict | None] = mapped_column(JSONB)
    submission: Mapped[dict | None] = mapped_column(JSONB)
    score: Mapped[float | None] = mapped_column(Numeric(3, 1))
    feedback: Mapped[dict | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(Text, default="generating")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
