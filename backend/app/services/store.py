from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.config import get_settings
from app.services.memory_store import _iso_week_of, _is_ask_message, memory_store
from app.services.supabase_client import get_supabase_client


QUIZ_SESSION_COLUMNS = {
    "id",
    "user_id",
    "document_id",
    "progress",
    "score",
    "history",
    "questions",
    "flashcards",
    "output_type",
    "status",
    "created_at",
    "updated_at",
}

QUIZ_SESSION_CORE_COLUMNS = QUIZ_SESSION_COLUMNS - {"flashcards", "output_type"}

STUDY_MESSAGE_COLUMNS = {
    "id",
    "user_id",
    "document_id",
    "role",
    "content",
    "prompt_kind",
    "chip_id",
    "retrieval",
    "quiz_session_id",
    "created_at",
}


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

    def list_documents(self, user_id: str) -> list[dict[str, Any]]:
        client = get_supabase_client()
        if not client:
            return memory_store.list_documents(user_id)
        response = (
            client.table("documents")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []

    def create_profile(self, row: dict[str, Any]) -> dict[str, Any]:
        # Local profiles stay in memory; Supabase Auth owns real accounts.
        return memory_store.create_profile(row)

    def get_profile(self, user_id: str) -> dict[str, Any] | None:
        return memory_store.get_profile(user_id)

    def get_profile_by_email(self, email: str) -> dict[str, Any] | None:
        return memory_store.get_profile_by_email(email)

    def create_session(self, user_id: str) -> str:
        return memory_store.create_session(user_id)

    def get_session_user(self, token: str) -> str | None:
        return memory_store.get_session_user(token)

    def clear_session(self, token: str) -> None:
        memory_store.clear_session(token)

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
        payload = _pick(row, QUIZ_SESSION_COLUMNS)
        try:
            response = client.table("quiz_sessions").insert(payload).execute()
            return {**row, **((response.data or [payload])[0])}
        except Exception:
            core = _pick(row, QUIZ_SESSION_CORE_COLUMNS)
            try:
                response = client.table("quiz_sessions").insert(core).execute()
                return {**row, **((response.data or [core])[0])}
            except Exception:
                return memory_store.create_quiz_session(row)

    def get_quiz_session(self, user_id: str, session_id: str) -> dict[str, Any] | None:
        local = memory_store.get_quiz_session(user_id, session_id)
        if local:
            return local
        client = get_supabase_client()
        if not client:
            return None
        try:
            response = (
                client.table("quiz_sessions")
                .select("*")
                .eq("id", session_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            data = response.data or []
            return data[0] if data else None
        except Exception:
            return None

    def update_quiz_session(self, row: dict[str, Any]) -> dict[str, Any]:
        saved = memory_store.update_quiz_session(row)
        client = get_supabase_client()
        if not client:
            return saved
        payload = {
            "history": row.get("history") or [],
            "progress": row.get("progress") or 0,
            "status": row.get("status") or "in_progress",
            "updated_at": row.get("updated_at") or _now_iso(),
        }
        try:
            client.table("quiz_sessions").update(payload).eq("id", row["id"]).eq(
                "user_id", row["user_id"]
            ).execute()
        except Exception:
            pass
        return saved

    def create_study_message(self, row: dict[str, Any]) -> dict[str, Any]:
        local = memory_store.create_study_message(row)
        client = get_supabase_client()
        if not client:
            return local
        payload = _pick(row, STUDY_MESSAGE_COLUMNS)
        try:
            response = client.table("study_messages").insert(payload).execute()
            return {**row, **((response.data or [payload])[0])}
        except Exception:
            return local

    def list_study_messages(self, user_id: str, document_id: str) -> list[dict[str, Any]]:
        client = get_supabase_client()
        if not client:
            return memory_store.list_study_messages(user_id, document_id)
        try:
            response = (
                client.table("study_messages")
                .select("*")
                .eq("user_id", user_id)
                .eq("document_id", document_id)
                .order("created_at")
                .execute()
            )
            rows = response.data or []
            if rows:
                return rows
        except Exception:
            pass
        return memory_store.list_study_messages(user_id, document_id)

    def count_ask_messages_in_week(self, user_id: str, week_id: str) -> int:
        client = get_supabase_client()
        if not client:
            return memory_store.count_ask_messages_in_week(user_id, week_id)
        try:
            response = (
                client.table("study_messages")
                .select("id, created_at, role, prompt_kind, chip_id, user_id")
                .eq("user_id", user_id)
                .eq("role", "user")
                .execute()
            )
            count = 0
            for row in response.data or []:
                if not _is_ask_message(row, user_id):
                    continue
                if _iso_week_of(row.get("created_at")) == week_id:
                    count += 1
            return count
        except Exception:
            return memory_store.count_ask_messages_in_week(user_id, week_id)

    def count_chats_in_week(self, user_id: str, week_id: str) -> int:
        return self.count_quiz_sessions_in_week(user_id, week_id) + self.count_ask_messages_in_week(
            user_id, week_id
        )

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

    def set_profile_plan(
        self,
        user_id: str,
        plan: str,
        status: str | None = None,
        expires_at: str | None = None,
    ) -> dict[str, Any] | None:
        saved = memory_store.set_profile_plan(user_id, plan, status, expires_at)
        client = get_supabase_client()
        if client:
            try:
                client.table("profiles").update(
                    {
                        "plan": plan,
                        "plan_status": status or "active",
                        "plan_expires_at": expires_at,
                        "updated_at": _now_iso(),
                    }
                ).eq("id", user_id).execute()
            except Exception:
                pass
        return saved

    def count_documents(self, user_id: str) -> int:
        client = get_supabase_client()
        if not client:
            return memory_store.count_documents(user_id)
        try:
            response = (
                client.table("documents")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .execute()
            )
            if response.count is not None:
                return int(response.count)
            return len(response.data or [])
        except Exception:
            return memory_store.count_documents(user_id)

    def count_quiz_sessions_in_week(self, user_id: str, week_id: str) -> int:
        client = get_supabase_client()
        if not client:
            return memory_store.count_quiz_sessions_in_week(user_id, week_id)
        try:
            response = (
                client.table("quiz_sessions")
                .select("id, created_at")
                .eq("user_id", user_id)
                .execute()
            )
            count = 0
            for row in response.data or []:
                if _iso_week_of(row.get("created_at")) == week_id:
                    count += 1
            return count
        except Exception:
            return memory_store.count_quiz_sessions_in_week(user_id, week_id)

    def upsert_entitlement(self, email: str, payload: dict[str, Any]) -> dict[str, Any]:
        saved = memory_store.upsert_entitlement(email, payload)
        client = get_supabase_client()
        if client:
            try:
                row = {
                    "email": saved["email"],
                    "plan": saved.get("plan") or "free",
                    "status": saved.get("status") or "active",
                    "sku": saved.get("sku"),
                    "shopify_order_id": saved.get("shopify_order_id"),
                    "shopify_contract_id": saved.get("shopify_contract_id"),
                    "shopify_customer_id": saved.get("shopify_customer_id"),
                    "source": saved.get("source"),
                    "shop_domain": saved.get("shop_domain"),
                    "expires_at": saved.get("expires_at"),
                    "updated_at": _now_iso(),
                }
                client.table("membership_entitlements").upsert(
                    row, on_conflict="email"
                ).execute()
            except Exception:
                pass
        return saved

    def get_entitlement_by_email(self, email: str) -> dict[str, Any] | None:
        local = memory_store.get_entitlement_by_email(email)
        if local:
            return local
        client = get_supabase_client()
        if not client:
            return None
        try:
            response = (
                client.table("membership_entitlements")
                .select("*")
                .eq("email", email.strip().lower())
                .limit(1)
                .execute()
            )
            data = response.data or []
            if data:
                memory_store.upsert_entitlement(email, data[0])
                return data[0]
        except Exception:
            return None
        return None

    def get_entitlement_by_contract(self, contract_id: str) -> dict[str, Any] | None:
        local = memory_store.get_entitlement_by_contract(contract_id)
        if local:
            return local
        client = get_supabase_client()
        if not client:
            return None
        try:
            response = (
                client.table("membership_entitlements")
                .select("*")
                .eq("shopify_contract_id", str(contract_id))
                .limit(1)
                .execute()
            )
            data = response.data or []
            if data:
                email = data[0].get("email")
                if email:
                    memory_store.upsert_entitlement(email, data[0])
                return data[0]
        except Exception:
            return None
        return None

    def get_entitlement_by_customer(self, customer_id: str) -> dict[str, Any] | None:
        local = memory_store.get_entitlement_by_customer(customer_id)
        if local:
            return local
        client = get_supabase_client()
        if not client:
            return None
        try:
            response = (
                client.table("membership_entitlements")
                .select("*")
                .eq("shopify_customer_id", str(customer_id))
                .limit(1)
                .execute()
            )
            data = response.data or []
            if data:
                email = data[0].get("email")
                if email:
                    memory_store.upsert_entitlement(email, data[0])
                return data[0]
        except Exception:
            return None
        return None

    def set_supabase_plan_by_email(
        self,
        email: str,
        plan: str,
        status: str | None = None,
        expires_at: str | None = None,
    ) -> None:
        user_id = self.find_supabase_user_id_by_email(email)
        if not user_id:
            return
        client = get_supabase_client()
        if not client:
            return
        try:
            client.table("profiles").update(
                {
                    "plan": plan,
                    "plan_status": status or "active",
                    "plan_expires_at": expires_at,
                    "email": email.strip().lower(),
                    "updated_at": _now_iso(),
                }
            ).eq("id", user_id).execute()
        except Exception:
            pass

    def find_supabase_user_id_by_email(self, email: str) -> str | None:
        client = get_supabase_client()
        if not client:
            return None
        normalized = email.strip().lower()
        try:
            response = (
                client.table("profiles")
                .select("id, email")
                .eq("email", normalized)
                .limit(1)
                .execute()
            )
            data = response.data or []
            if data:
                return str(data[0]["id"])
        except Exception:
            pass
        try:
            listed = client.auth.admin.list_users()
            users = getattr(listed, "users", None) or listed or []
            for user in users:
                user_email = getattr(user, "email", None)
                user_id = getattr(user, "id", None)
                if isinstance(user, dict):
                    user_email = user.get("email")
                    user_id = user.get("id")
                if (user_email or "").strip().lower() == normalized and user_id:
                    return str(user_id)
        except Exception:
            return None
        return None


store = DataStore()


def _pick(row: dict[str, Any], keys: set[str]) -> dict[str, Any]:
    return {key: row[key] for key in keys if key in row and row[key] is not None}
