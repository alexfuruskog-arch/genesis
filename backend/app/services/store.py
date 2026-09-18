from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.config import get_settings
from app.services.memory_store import memory_store
from app.services.supabase_client import get_supabase_client


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DataStore:
    """Supabase-backed store with an in-memory fallback for local runs."""

    def __init__(self) -> None:
        self.settings = get_settings()

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

    def record_webhook(self, event: dict[str, Any]) -> dict[str, Any]:
        event = {"id": str(uuid4()), "received_at": _now_iso(), **event}
        return memory_store.record_webhook(event)

    def recent_webhooks(self) -> list[dict[str, Any]]:
        return memory_store.recent_webhooks()


store = DataStore()
