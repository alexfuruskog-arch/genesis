from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.services.store import store


def _hash_password(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()


class AuthService:
    """Local MVP auth. Prefer Supabase Auth when keys exist; otherwise memory profiles."""

    def signup(self, email: str, password: str) -> dict[str, Any]:
        normalized = email.strip().lower()
        if "@" not in normalized:
            raise ValueError("Enter a valid email address.")
        existing = store.get_profile_by_email(normalized)
        if existing:
            raise ValueError("An account with that email already exists.")
        salt = secrets.token_hex(8)
        profile = {
            "id": str(uuid4()),
            "email": normalized,
            "password_salt": salt,
            "password_hash": _hash_password(password, salt),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        saved = store.create_profile(profile)
        token = store.create_session(saved["id"])
        return {
            "id": saved["id"],
            "email": saved["email"],
            "source": "local",
            "token": token,
            "message": "Account created. Session is local until Supabase Auth is configured.",
        }

    def login(self, email: str, password: str) -> dict[str, Any]:
        normalized = email.strip().lower()
        profile = store.get_profile_by_email(normalized)
        if not profile:
            raise ValueError("Invalid email or password.")
        expected = _hash_password(password, profile["password_salt"])
        if not secrets.compare_digest(expected, profile["password_hash"]):
            raise ValueError("Invalid email or password.")
        token = store.create_session(profile["id"])
        return {
            "id": profile["id"],
            "email": profile["email"],
            "source": "local",
            "token": token,
            "message": None,
        }

    def resolve_session(self, token: str | None) -> dict[str, Any] | None:
        if not token:
            return None
        user_id = store.get_session_user(token)
        if not user_id:
            return None
        profile = store.get_profile(user_id)
        if not profile:
            return None
        return {
            "id": profile["id"],
            "email": profile["email"],
            "source": "local",
        }

    def logout(self, token: str | None) -> None:
        if token:
            store.clear_session(token)


auth_service = AuthService()
