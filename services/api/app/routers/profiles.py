import uuid
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from app.config import get_settings
from app.deps import CurrentUser, DbSession
from app.models import Profile
from app.schemas.profiles import ProfileOut, ProfileUpdate

router = APIRouter(prefix="/me", tags=["profile"])


def _to_out(p: Profile) -> ProfileOut:
    return ProfileOut(
        user_id=str(p.user_id),
        display_name=p.display_name,
        profession=p.profession,
        industry=p.industry,
        education=p.education,
        goals=p.goals or [],
        weaknesses=p.weaknesses or [],
        strengths=p.strengths or [],
        speaking_confidence=p.speaking_confidence,
        primary_use_cases=p.primary_use_cases or [],
        onboarding_completed_at=p.onboarding_completed_at,
    )


async def _get_profile(db: DbSession, user_id: str) -> Profile:
    result = await db.execute(select(Profile).where(Profile.user_id == uuid.UUID(user_id)))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.get("/profile", response_model=ProfileOut)
async def get_profile(user: CurrentUser, db: DbSession) -> ProfileOut:
    return _to_out(await _get_profile(db, user.id))


@router.put("/profile", response_model=ProfileOut)
async def update_profile(body: ProfileUpdate, user: CurrentUser, db: DbSession) -> ProfileOut:
    profile = await _get_profile(db, user.id)
    data = body.model_dump(exclude_unset=True)
    completed = data.pop("onboarding_completed", None)
    for field, value in data.items():
        setattr(profile, field, value)
    if completed:
        profile.onboarding_completed_at = datetime.now(UTC)
    profile.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(profile)
    return _to_out(profile)


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(user: CurrentUser) -> Response:
    """Permanently delete the user's auth account; all data cascades from it."""
    settings = get_settings()
    if not settings.supabase_service_role_key:
        raise HTTPException(status_code=503, detail="Account deletion is not configured")

    # Best-effort: remove the user's stored recordings first.
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            listing = await client.post(
                f"{settings.supabase_url}/storage/v1/object/list/recordings",
                headers=headers,
                json={"prefix": f"{user.id}/"},
            )
            names = [f"{user.id}/{o['name']}" for o in listing.json()] if listing.is_success else []
            if names:
                await client.request(
                    "DELETE",
                    f"{settings.supabase_url}/storage/v1/object/recordings",
                    headers=headers,
                    json={"prefixes": names},
                )
        except Exception:
            pass  # storage cleanup is best-effort; DB cascade is the source of truth

        # Deleting the auth user cascades to every table that references it.
        resp = await client.delete(
            f"{settings.supabase_url}/auth/v1/admin/users/{user.id}", headers=headers
        )
        if resp.status_code not in (200, 204):
            raise HTTPException(status_code=502, detail=f"Could not delete account: {resp.text}")

    return Response(status_code=status.HTTP_204_NO_CONTENT)
