from typing import Annotated, Literal

from fastapi import Header, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.services.supabase_client import fetch_auth_user


class CurrentUser(BaseModel):
    id: str
    email: str | None = None
    source: Literal["supabase", "dev"]


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    x_user_id: Annotated[str | None, Header(alias="X-User-Id")] = None,
) -> CurrentUser:
    """Resolve the caller from a Supabase JWT, or a local dev fallback."""
    settings = get_settings()
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()

    if token and settings.supabase_enabled:
        user = await fetch_auth_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Ogiltig Supabase-session.")
        return CurrentUser(
            id=user["id"],
            email=user.get("email"),
            source="supabase",
        )

    if token and not settings.supabase_enabled:
        raise HTTPException(
            status_code=401,
            detail="Supabase är inte konfigurerat, så JWT kan inte valideras.",
        )

    return CurrentUser(
        id=x_user_id or "local-dev-user",
        email=None,
        source="dev",
    )
