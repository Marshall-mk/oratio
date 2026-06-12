import uuid
from datetime import datetime

from sqlalchemy import ARRAY, DateTime, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Profile(Base):
    __tablename__ = "profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    display_name: Mapped[str | None] = mapped_column(Text)
    profession: Mapped[str | None] = mapped_column(Text)
    industry: Mapped[str | None] = mapped_column(Text)
    education: Mapped[str | None] = mapped_column(Text)
    goals: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    weaknesses: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    strengths: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    speaking_confidence: Mapped[int | None] = mapped_column(Integer)
    primary_use_cases: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
