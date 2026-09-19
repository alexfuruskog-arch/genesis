from typing import Annotated, Literal

from fastapi import Header, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.services.auth import auth_service
from app.services.supabase_client import fetch_auth_user


class CurrentUser(BaseModel):
    id: str
    email: str | None = None
    source: Literal["supabase", "local", "dev"]


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    x_user_id: Annotated[str | None, Header(alias="X-User-Id")] = None,
) -> CurrentUser:
    """Resolve the caller from Supabase JWT, local session, or X-User-Id fallback."""
    settings = get_settings()
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()

    if token and settings.supabase_enabled:
        user = await fetch_auth_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid Supabase session.")
        return CurrentUser(
            id=user["id"],
            email=user.get("email"),
            source="supabase",
        )

    if token:
        local = auth_service.resolve_session(token)
        if local:
            return CurrentUser(
                id=local["id"],
                email=local.get("email"),
                source="local",
            )
        if settings.supabase_enabled:
            raise HTTPException(status_code=401, detail="Invalid session token.")
        # Without Supabase, unknown bearer tokens are rejected unless X-User-Id is set.
        if not x_user_id:
            raise HTTPException(status_code=401, detail="Invalid session token.")

    return CurrentUser(
        id=x_user_id or "local-dev-user",
        email=None,
        source="dev",
    )
