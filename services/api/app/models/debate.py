import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Debate(Base):
    __tablename__ = "debates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    motion: Mapped[str] = mapped_column(Text)
    format: Mapped[str] = mapped_column(Text)  # ranked | sides | rebuttal
    participants: Mapped[list] = mapped_column(JSONB, default=list)  # [{name, side}]
    status: Mapped[str] = mapped_column(Text, default="in_progress")
    result: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DebateTurn(Base):
    __tablename__ = "debate_turns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    debate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("debates.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    participant: Mapped[str] = mapped_column(Text)
    round: Mapped[int] = mapped_column(Integer, default=1)
    transcript: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
