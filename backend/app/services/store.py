from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.config import get_settings
from app.services.memory_store import memory_store
from app.services.supabase_client import get_supabase_client


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _install_file() -> Path:
    settings = get_settings()
    path = Path(settings.local_shopify_install_path)
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[2] / path
    return path


class DataStore:
    """Supabase-backed store with an in-memory fallback for local runs."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._load_local_shopify_install()

    @property
    def backend(self) -> str:
        return "supabase" if self.settings.supabase_enabled else "memory"

    def create_document(self, row: dict[str, Any]) -> dict[str, Any]:
        client = get_supabase_client()
        if not client:
            return memory_store.create_document(row)
        response = client.table("documents").insert(row).execute()
        return (response.data or [row])[0]

    def get_document(self, user_id: str, document_id: str) -> dict[str, Any] | None:
        client = get_supabase_client()
        if not client:
            return memory_store.get_document(user_id, document_id)
        response = (
            client.table("documents")
            .select("*")
            .eq("id", document_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        data = response.data or []
        return data[0] if data else None

    def save_chunks(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        client = get_supabase_client()
        if not client:
            return memory_store.save_chunks(rows)
        if not rows:
            return []
        response = client.table("document_chunks").insert(rows).execute()
        return response.data or rows

    def list_chunks(self, user_id: str, document_id: str) -> list[dict[str, Any]]:
        client = get_supabase_client()
        if not client:
            return memory_store.list_chunks(user_id, document_id)
        response = (
            client.table("document_chunks")
            .select("id, content, chunk_index, embedding")
            .eq("document_id", document_id)
            .eq("user_id", user_id)
            .order("chunk_index")
            .execute()
        )
        return response.data or []

    def match_chunks(
        self,
        user_id: str,
        document_id: str,
        query_embedding: list[float] | None,
        match_count: int,
    ) -> list[dict[str, Any]]:
        client = get_supabase_client()
        if not client:
            return memory_store.match_chunks(
                user_id, document_id, query_embedding, match_count
            )
        if query_embedding:
            try:
                response = client.rpc(
                    "match_document_chunks",
                    {
                        "query_embedding": query_embedding,
                        "match_document_id": document_id,
                        "match_user_id": user_id,
                        "match_count": match_count,
                    },
                ).execute()
                rows = response.data or []
                if rows:
                    return rows
            except Exception:
                pass
        return self.list_chunks(user_id, document_id)[:match_count]

    def create_quiz_session(self, row: dict[str, Any]) -> dict[str, Any]:
        client = get_supabase_client()
        if not client:
            return memory_store.create_quiz_session(row)
        response = client.table("quiz_sessions").insert(row).execute()
        return (response.data or [row])[0]

    def upsert_shopify_customer(self, user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        client = get_supabase_client()
        if not client:
            return memory_store.upsert_shopify_customer(user_id, payload)
        row = {
            "user_id": user_id,
            "updated_at": _now_iso(),
            **payload,
        }
        response = (
            client.table("shopify_customers")
            .upsert(row, on_conflict="user_id")
            .execute()
        )
        return (response.data or [row])[0]

    def get_shopify_customer(self, user_id: str) -> dict[str, Any] | None:
        client = get_supabase_client()
        if not client:
            return memory_store.get_shopify_customer(user_id)
        response = (
            client.table("shopify_customers")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        data = response.data or []
        return data[0] if data else None

    def save_shopify_install(self, row: dict[str, Any]) -> dict[str, Any]:
        saved = memory_store.upsert_shopify_install(row)
        self._write_local_shopify_install(saved)
        client = get_supabase_client()
        if client:
            try:
                client.table("shopify_installs").update({"is_active": False}).neq(
                    "shop_domain", row["shop_domain"]
                ).execute()
                client.table("shopify_installs").upsert(
                    row, on_conflict="shop_domain"
                ).execute()
            except Exception:
                pass
        return saved

    def get_active_shopify_install(self) -> dict[str, Any] | None:
        local = memory_store.get_active_shopify_install()
        if local:
            return local
        client = get_supabase_client()
        if not client:
            return None
        try:
            response = (
                client.table("shopify_installs")
                .select("shop_domain, access_token, scope, connection_method, shop_name, is_active")
                .eq("is_active", True)
                .limit(1)
                .execute()
            )
            data = response.data or []
            if data:
                memory_store.upsert_shopify_install(data[0])
                return data[0]
        except Exception:
            return None
        return None

    def clear_shopify_installs(self) -> None:
        memory_store.clear_shopify_installs()
        path = _install_file()
        if path.exists():
            path.unlink()
        client = get_supabase_client()
        if client:
            try:
                client.table("shopify_installs").update({"is_active": False}).neq(
                    "shop_domain", ""
                ).execute()
            except Exception:
                pass

    def put_oauth_state(self, state: str, payload: dict[str, Any]) -> None:
        memory_store.put_oauth_state(state, payload)

    def pop_oauth_state(self, state: str) -> dict[str, Any] | None:
        return memory_store.pop_oauth_state(state)

    def _load_local_shopify_install(self) -> None:
        path = _install_file()
        if not path.exists():
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        if isinstance(data, dict) and data.get("shop_domain") and data.get("access_token"):
            memory_store.upsert_shopify_install(data)

    def _write_local_shopify_install(self, row: dict[str, Any]) -> None:
        path = _install_file()
        path.write_text(json.dumps(row, indent=2), encoding="utf-8")

    def record_webhook(self, event: dict[str, Any]) -> dict[str, Any]:
        event = {"id": str(uuid4()), "received_at": _now_iso(), **event}
        return memory_store.record_webhook(event)

    def recent_webhooks(self) -> list[dict[str, Any]]:
        return memory_store.recent_webhooks()


store = DataStore()
