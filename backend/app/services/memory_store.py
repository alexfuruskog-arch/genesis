from __future__ import annotations

import math
from datetime import datetime, timezone
from threading import Lock
from typing import Any
from uuid import uuid4


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MemoryStore:
    """In-process fallback used when Supabase env vars are missing."""

    def __init__(self) -> None:
        self._lock = Lock()
        self.documents: dict[str, dict[str, Any]] = {}
        self.chunks: dict[str, dict[str, Any]] = {}
        self.quiz_sessions: dict[str, dict[str, Any]] = {}
        self.study_messages: dict[str, dict[str, Any]] = {}
        self.shopify_customers: dict[str, dict[str, Any]] = {}
        self.shopify_installs: dict[str, dict[str, Any]] = {}
        self.oauth_states: dict[str, dict[str, Any]] = {}
        self.webhooks: list[dict[str, Any]] = []
        self.profiles: dict[str, dict[str, Any]] = {}
        self.profiles_by_email: dict[str, str] = {}
        self.sessions: dict[str, str] = {}
        self.entitlements: dict[str, dict[str, Any]] = {}

    def reset(self) -> None:
        with self._lock:
            self.documents.clear()
            self.chunks.clear()
            self.quiz_sessions.clear()
            self.study_messages.clear()
            self.shopify_customers.clear()
            self.shopify_installs.clear()
            self.oauth_states.clear()
            self.webhooks.clear()
            self.profiles.clear()
            self.profiles_by_email.clear()
            self.sessions.clear()
            self.entitlements.clear()

    def create_document(self, row: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self.documents[row["id"]] = row
            return row

    def get_document(self, user_id: str, document_id: str) -> dict[str, Any] | None:
        doc = self.documents.get(document_id)
        if not doc or doc["user_id"] != user_id:
            return None
        return doc

    def list_documents(self, user_id: str) -> list[dict[str, Any]]:
        rows = [doc for doc in self.documents.values() if doc["user_id"] == user_id]
        return sorted(rows, key=lambda item: item.get("created_at") or "", reverse=True)

    def create_profile(self, row: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            row = {
                "plan": "free",
                "plan_status": "none",
                "plan_expires_at": None,
                **row,
            }
            self.profiles[row["id"]] = row
            email = (row.get("email") or "").strip().lower()
            if email:
                self.profiles_by_email[email] = row["id"]
            return row

    def get_profile(self, user_id: str) -> dict[str, Any] | None:
        return self.profiles.get(user_id)

    def get_profile_by_email(self, email: str) -> dict[str, Any] | None:
        user_id = self.profiles_by_email.get(email)
        if not user_id:
            return None
        return self.profiles.get(user_id)

    def create_session(self, user_id: str) -> str:
        token = str(uuid4())
        with self._lock:
            self.sessions[token] = user_id
        return token

    def get_session_user(self, token: str) -> str | None:
        return self.sessions.get(token)

    def clear_session(self, token: str) -> None:
        with self._lock:
            self.sessions.pop(token, None)

    def save_chunks(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        with self._lock:
            for row in rows:
                self.chunks[row["id"]] = row
        return rows

    def list_chunks(self, user_id: str, document_id: str) -> list[dict[str, Any]]:
        rows = [
            chunk
            for chunk in self.chunks.values()
            if chunk["document_id"] == document_id and chunk["user_id"] == user_id
        ]
        return sorted(rows, key=lambda item: item["chunk_index"])

    def match_chunks(
        self,
        user_id: str,
        document_id: str,
        query_embedding: list[float] | None,
        match_count: int,
    ) -> list[dict[str, Any]]:
        rows = self.list_chunks(user_id, document_id)
        if not rows:
            return []
        if query_embedding and any(row.get("embedding") for row in rows):
            scored: list[tuple[float, dict[str, Any]]] = []
            for row in rows:
                embedding = row.get("embedding")
                if not embedding:
                    continue
                scored.append((_cosine(query_embedding, embedding), row))
            scored.sort(key=lambda item: item[0], reverse=True)
            return [row for _, row in scored[:match_count]]
        return rows[:match_count]

    def create_quiz_session(self, row: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self.quiz_sessions[row["id"]] = row
            return row

    def get_quiz_session(self, user_id: str, session_id: str) -> dict[str, Any] | None:
        row = self.quiz_sessions.get(session_id)
        if not row or row.get("user_id") != user_id:
            return None
        return row

    def update_quiz_session(self, row: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self.quiz_sessions[row["id"]] = row
            return row

    def create_study_message(self, row: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self.study_messages[row["id"]] = row
            return row

    def list_study_messages(self, user_id: str, document_id: str) -> list[dict[str, Any]]:
        rows = [
            message
            for message in self.study_messages.values()
            if message.get("user_id") == user_id and message.get("document_id") == document_id
        ]
        return sorted(rows, key=lambda item: item.get("created_at") or "")

    def count_ask_messages_in_week(self, user_id: str, week_id: str) -> int:
        count = 0
        for row in self.study_messages.values():
            if not _is_ask_message(row, user_id):
                continue
            if _iso_week_of(row.get("created_at")) == week_id:
                count += 1
        return count

    def upsert_shopify_customer(self, user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            existing = self.shopify_customers.get(user_id)
            row = {
                "id": existing["id"] if existing else str(uuid4()),
                "user_id": user_id,
                "updated_at": _now().isoformat(),
                **(existing or {}),
                **payload,
            }
            if not existing:
                row["created_at"] = _now().isoformat()
            self.shopify_customers[user_id] = row
            return row

    def get_shopify_customer(self, user_id: str) -> dict[str, Any] | None:
        return self.shopify_customers.get(user_id)

    def upsert_shopify_install(self, row: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            for existing in self.shopify_installs.values():
                existing["is_active"] = existing.get("shop_domain") == row["shop_domain"]
            self.shopify_installs[row["shop_domain"]] = row
            return row

    def get_active_shopify_install(self) -> dict[str, Any] | None:
        active = [row for row in self.shopify_installs.values() if row.get("is_active")]
        if active:
            return active[0]
        if len(self.shopify_installs) == 1:
            return next(iter(self.shopify_installs.values()))
        return None

    def clear_shopify_installs(self) -> None:
        with self._lock:
            self.shopify_installs.clear()

    def put_oauth_state(self, state: str, payload: dict[str, Any]) -> None:
        with self._lock:
            self.oauth_states[state] = payload

    def pop_oauth_state(self, state: str) -> dict[str, Any] | None:
        with self._lock:
            return self.oauth_states.pop(state, None)

    def record_webhook(self, event: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self.webhooks.insert(0, event)
            self.webhooks[:] = self.webhooks[:25]
        return event

    def recent_webhooks(self) -> list[dict[str, Any]]:
        return list(self.webhooks)

    def set_profile_plan(
        self,
        user_id: str,
        plan: str,
        status: str | None = None,
        expires_at: str | None = None,
    ) -> dict[str, Any] | None:
        with self._lock:
            profile = self.profiles.get(user_id)
            if not profile:
                return None
            profile["plan"] = plan
            profile["plan_status"] = status or "active"
            profile["plan_expires_at"] = expires_at
            return profile

    def count_documents(self, user_id: str) -> int:
        return len([doc for doc in self.documents.values() if doc.get("user_id") == user_id])

    def count_quiz_sessions_in_week(self, user_id: str, week_id: str) -> int:
        count = 0
        for row in self.quiz_sessions.values():
            if row.get("user_id") != user_id:
                continue
            if _iso_week_of(row.get("created_at")) == week_id:
                count += 1
        return count

    def upsert_entitlement(self, email: str, payload: dict[str, Any]) -> dict[str, Any]:
        key = email.strip().lower()
        with self._lock:
            existing = self.entitlements.get(key) or {}
            row = {
                **existing,
                **payload,
                "email": key,
                "updated_at": _now().isoformat(),
            }
            if not existing:
                row["created_at"] = _now().isoformat()
            self.entitlements[key] = row
            return row

    def get_entitlement_by_email(self, email: str) -> dict[str, Any] | None:
        return self.entitlements.get(email.strip().lower())

    def get_entitlement_by_contract(self, contract_id: str) -> dict[str, Any] | None:
        target = str(contract_id)
        for row in self.entitlements.values():
            if str(row.get("shopify_contract_id") or "") == target:
                return row
        return None

    def get_entitlement_by_customer(self, customer_id: str) -> dict[str, Any] | None:
        target = str(customer_id)
        for row in self.entitlements.values():
            if str(row.get("shopify_customer_id") or "") == target:
                return row
        return None


ASK_CHIP_IDS = {"explain", "summarize"}


def _iso_week_of(created: Any) -> str | None:
    if not created:
        return None
    raw = str(created)
    try:
        moment = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    year, week, _ = moment.isocalendar()
    return f"{year}-W{week:02d}"


def _is_ask_message(row: dict[str, Any], user_id: str) -> bool:
    if row.get("user_id") != user_id or row.get("role") != "user":
        return False
    chip_id = row.get("chip_id")
    if row.get("prompt_kind") == "free_text":
        return True
    return chip_id in ASK_CHIP_IDS


def _cosine(left: list[float], right: list[float]) -> float:
    width = min(len(left), len(right))
    if width == 0:
        return 0.0
    dot = sum(left[i] * right[i] for i in range(width))
    n1 = math.sqrt(sum(value * value for value in left[:width]))
    n2 = math.sqrt(sum(value * value for value in right[:width]))
    if n1 == 0 or n2 == 0:
        return 0.0
    return dot / (n1 * n2)


memory_store = MemoryStore()
