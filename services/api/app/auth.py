"""Supabase JWT verification.

Mobile clients authenticate against Supabase Auth directly; every request to this
API carries the Supabase access token. We verify it against the project's JWKS
endpoint (asymmetric keys) and fall back to rejecting anything we can't verify.
"""

import time
from dataclasses import dataclass

import httpx
import jwt
from fastapi import HTTPException, status

from app.config import get_settings

_JWKS_TTL_SECONDS = 3600
_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0.0


@dataclass(frozen=True)
class AuthedUser:
    id: str  # auth.users UUID (JWT `sub`)
    email: str | None


async def _get_jwks() -> dict:
    global _jwks_cache, _jwks_fetched_at
    if _jwks_cache is not None and time.monotonic() - _jwks_fetched_at < _JWKS_TTL_SECONDS:
        return _jwks_cache
    settings = get_settings()
    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
    _jwks_cache = resp.json()
    _jwks_fetched_at = time.monotonic()
    return _jwks_cache


async def verify_token(token: str) -> AuthedUser:
    settings = get_settings()
    try:
        header = jwt.get_unverified_header(token)
        if settings.supabase_jwt_secret and header.get("alg") == "HS256":
            # Local Supabase stack (shared-secret signing).
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                options={"require": ["exp", "sub"]},
            )
            return AuthedUser(id=payload["sub"], email=payload.get("email"))
        jwks = await _get_jwks()
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == header.get("kid")), None)
        if key is None:
            raise jwt.InvalidTokenError("No matching JWKS key")
        public_key = jwt.PyJWK(key).key
        payload = jwt.decode(
            token,
            public_key,
            algorithms=[header.get("alg", "ES256")],
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
    except (jwt.InvalidTokenError, httpx.HTTPError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc
    if settings.supabase_url and payload.get("iss", "").rstrip("/") != f"{settings.supabase_url}/auth/v1":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad issuer")
    return AuthedUser(id=payload["sub"], email=payload.get("email"))
