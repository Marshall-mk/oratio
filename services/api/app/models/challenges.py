import uuid
from datetime import datetime

from sqlalchemy import ARRAY, Boolean, DateTime, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    slug: Mapped[str] = mapped_column(Text, unique=True)
    title: Mapped[str] = mapped_column(Text)
    prompt: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(Text)  # thought | structure | speaking
    framework: Mapped[str | None] = mapped_column(Text)  # prep | star | scientific | story | pyramid
    difficulty: Mapped[str] = mapped_column(Text, default="beginner")
    prep_seconds: Mapped[int] = mapped_column(Integer, default=30)
    max_speak_seconds: Mapped[int] = mapped_column(Integer, default=120)
    evaluation_focus: Mapped[dict] = mapped_column(JSONB, default=dict)
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    mode: Mapped[str] = mapped_column(Text, default="monologue")  # monologue | roleplay
    persona: Mapped[dict | None] = mapped_column(JSONB)  # {name, voice, instruction, opener}
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
