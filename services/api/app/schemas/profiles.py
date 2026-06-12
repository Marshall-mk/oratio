from datetime import datetime

from pydantic import BaseModel, Field


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    profession: str | None = None
    industry: str | None = None
    education: str | None = None
    goals: list[str] | None = None
    weaknesses: list[str] | None = None
    strengths: list[str] | None = None
    speaking_confidence: int | None = Field(default=None, ge=1, le=5)
    primary_use_cases: list[str] | None = None
    onboarding_completed: bool | None = None


class ProfileOut(BaseModel):
    user_id: str
    display_name: str | None
    profession: str | None
    industry: str | None
    education: str | None
    goals: list[str]
    weaknesses: list[str]
    strengths: list[str]
    speaking_confidence: int | None
    primary_use_cases: list[str]
    onboarding_completed_at: datetime | None

    model_config = {"from_attributes": False}
