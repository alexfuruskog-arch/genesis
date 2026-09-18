from __future__ import annotations

from typing import Any

import httpx
from supabase import Client, create_client

from app.config import get_settings

_client: Client | None = None


def get_supabase_client() -> Client | None:
    global _client
    settings = get_settings()
    if not settings.supabase_enabled:
        return None
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_key)
    return _client


async def fetch_auth_user(access_token: str) -> dict[str, Any] | None:
    settings = get_settings()
    if not settings.supabase_enabled or not settings.supabase_anon_key:
        return None
    url = settings.supabase_url.rstrip("/") + "/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "apikey": settings.supabase_anon_key,
    }
    async with httpx.AsyncClient(timeout=10.0) as http:
        response = await http.get(url, headers=headers)
    if response.status_code != 200:
        return None
    data = response.json()
    user_id = data.get("id")
    if not user_id:
        return None
    return {"id": user_id, "email": data.get("email")}
