from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app.deps import CurrentUser
from app.services.store import store

PLAN_FREE = "free"
PLAN_STANDARD = "standard"
PLAN_ANNUAL = "annual"
PLAN_SCHOLAR = "scholar"
PAID_PLANS = (PLAN_STANDARD, PLAN_ANNUAL, PLAN_SCHOLAR)
ALL_PLANS = (PLAN_FREE, *PAID_PLANS)

FREE_CHAT_CAP = 3
FREE_SCAN_CAP = 5

PLAN_RANK = {
    PLAN_FREE: 0,
    PLAN_STANDARD: 1,
    PLAN_ANNUAL: 2,
    PLAN_SCHOLAR: 3,
}

PLAN_LABELS = {
    PLAN_FREE: "Free",
    PLAN_STANDARD: "Standard · $12/mo",
    PLAN_ANNUAL: "Annual · $96/yr",
    PLAN_SCHOLAR: "Scholar · $29/mo",
}

MEMBERSHIP_SKUS = {
    "ARZ-MEM-STANDARD": PLAN_STANDARD,
    "ARZ-MEM-ANNUAL": PLAN_ANNUAL,
    "ARZ-MEM-SCHOLAR": PLAN_SCHOLAR,
}

MEMBERSHIP_HANDLES = {
    "membership-standard": PLAN_STANDARD,
    "membership-annual": PLAN_ANNUAL,
    "membership-scholar": PLAN_SCHOLAR,
}

_CANCELLED_STATUSES = {
    "cancelled",
    "canceled",
    "expired",
    "paused",
    "failed",
    "declined",
    "revoked",
}
_ACTIVE_STATUSES = {"active", "pending", "stale"}


class PlanLimitError(Exception):
    def __init__(self, message: str, *, kind: str, used: int, cap: int) -> None:
        super().__init__(message)
        self.kind = kind
        self.used = used
        self.cap = cap


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def normalize_plan(value: str | None) -> str:
    raw = (value or "").strip().lower()
    if raw in ALL_PLANS:
        return raw
    return PLAN_FREE


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    raw = value.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _iso_week_id(moment: datetime | None = None) -> str:
    current = moment or _now()
    year, week, _ = current.isocalendar()
    return f"{year}-W{week:02d}"


def _duration_for_plan(plan: str) -> timedelta:
    if plan == PLAN_ANNUAL:
        return timedelta(days=370)
    if plan in {PLAN_STANDARD, PLAN_SCHOLAR}:
        return timedelta(days=32)
    return timedelta(days=0)


def _best_plan(plans: list[str]) -> str:
    best = PLAN_FREE
    for plan in plans:
        if PLAN_RANK.get(plan, 0) > PLAN_RANK.get(best, 0):
            best = plan
    return best


def plan_from_sku_or_text(*parts: str | None) -> str | None:
    blob = " ".join(str(part) for part in parts if part).strip().lower()
    if not blob:
        return None
    for sku, plan in MEMBERSHIP_SKUS.items():
        if sku.lower() in blob:
            return plan
    for handle, plan in MEMBERSHIP_HANDLES.items():
        if handle in blob:
            return plan
    if "scholar membership" in blob or "study scholar" in blob:
        return PLAN_SCHOLAR
    if "annual membership" in blob or "study annual" in blob:
        return PLAN_ANNUAL
    if "standard membership" in blob or "study standard" in blob:
        return PLAN_STANDARD
    return None


def extract_email(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    customer = payload.get("customer") if isinstance(payload.get("customer"), dict) else {}
    billing = payload.get("billing_address") if isinstance(payload.get("billing_address"), dict) else {}
    candidates = [
        payload.get("email"),
        payload.get("contact_email"),
        payload.get("customer_email"),
        customer.get("email"),
        customer.get("contact_email"),
        billing.get("email"),
        (payload.get("email_address") or {}).get("email")
        if isinstance(payload.get("email_address"), dict)
        else payload.get("email_address"),
    ]
    for item in candidates:
        if isinstance(item, str) and "@" in item:
            return item.strip().lower()
    return None


def extract_customer_id(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    customer = payload.get("customer") if isinstance(payload.get("customer"), dict) else {}
    for value in (
        customer.get("id"),
        payload.get("customer_id"),
        payload.get("shopify_customer_id"),
    ):
        if value:
            return str(value)
    return None


def extract_contract_id(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    for key in ("subscription_contract_id", "contract_id", "admin_graphql_api_id"):
        value = payload.get(key)
        if value and "Order" not in str(value):
            text = str(value)
            if "gid://shopify/SubscriptionContract/" in text or key != "admin_graphql_api_id":
                if "SubscriptionContract" in text or key != "admin_graphql_api_id":
                    return text
    gid = payload.get("admin_graphql_api_id")
    if isinstance(gid, str) and "SubscriptionContract" in gid:
        return gid
    if payload.get("id") and "subscription_contract" in str(payload.get("id")):
        return str(payload["id"])
    for item in payload.get("line_items") or []:
        if not isinstance(item, dict):
            continue
        for key in ("subscription_contract_id", "contract_id"):
            if item.get(key):
                return str(item[key])
        contract = item.get("contract")
        if isinstance(contract, dict) and contract.get("id"):
            return str(contract["id"])
        if isinstance(contract, (str, int)):
            return str(contract)
    return str(payload["id"]) if payload.get("id") and not payload.get("line_items") else None


def extract_order_id(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    if payload.get("line_items") is not None and payload.get("id"):
        return str(payload["id"])
    if payload.get("order_id"):
        return str(payload["order_id"])
    order = payload.get("order")
    if isinstance(order, dict) and order.get("id"):
        return str(order["id"])
    return None


def _plan_from_line_item(item: dict[str, Any]) -> str | None:
    allocation = item.get("selling_plan_allocation") or {}
    selling_plan = allocation.get("selling_plan") if isinstance(allocation, dict) else {}
    properties = item.get("properties") or []
    prop_values: list[str] = []
    if isinstance(properties, list):
        for prop in properties:
            if isinstance(prop, dict):
                prop_values.append(str(prop.get("value") or ""))
                prop_values.append(str(prop.get("name") or ""))
    elif isinstance(properties, dict):
        prop_values.extend(str(v) for v in properties.values())
    return plan_from_sku_or_text(
        item.get("sku"),
        item.get("handle"),
        item.get("product_handle"),
        item.get("title"),
        item.get("name"),
        item.get("variant_title"),
        selling_plan.get("name") if isinstance(selling_plan, dict) else None,
        *prop_values,
    )


def extract_plan(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    found: list[str] = []
    for item in payload.get("line_items") or []:
        if isinstance(item, dict):
            plan = _plan_from_line_item(item)
            if plan:
                found.append(plan)
    lines = payload.get("lines") or payload.get("subscription_lines") or []
    for item in lines:
        if isinstance(item, dict):
            plan = plan_from_sku_or_text(
                item.get("sku"),
                item.get("title"),
                (item.get("product") or {}).get("handle")
                if isinstance(item.get("product"), dict)
                else None,
            )
            if plan:
                found.append(plan)
    direct = plan_from_sku_or_text(
        payload.get("sku"),
        payload.get("handle"),
        payload.get("title"),
        payload.get("name"),
        payload.get("plan"),
        (payload.get("selling_plan") or {}).get("name")
        if isinstance(payload.get("selling_plan"), dict)
        else payload.get("selling_plan"),
    )
    if direct:
        found.append(direct)
    if found:
        return _best_plan(found)
    return None


def _status_from_payload(payload: Any, topic: str) -> str:
    normalized = topic.replace("_", "/").lower()
    if not isinstance(payload, dict):
        payload = {}
    raw = str(payload.get("status") or payload.get("financial_status") or "").lower()
    if "cancel" in normalized or "refund" in normalized:
        return "cancelled"
    if raw in _CANCELLED_STATUSES:
        return "cancelled"
    if raw in _ACTIVE_STATUSES or normalized in {
        "orders/paid",
        "orders/create",
        "subscription_contracts/create",
        "subscription_billing_attempts/success",
    }:
        return "active"
    if raw:
        return raw
    return "active"


def is_revoke_event(topic: str, payload: Any) -> bool:
    normalized = topic.replace("_", "/").lower()
    if normalized in {
        "orders/cancelled",
        "refunds/create",
        "subscription_billing_attempts/failure",
    }:
        return True
    status = _status_from_payload(payload, topic)
    if status in _CANCELLED_STATUSES or status == "cancelled":
        if "subscription_contract" in normalized:
            return True
        if normalized in {"orders/cancelled", "refunds/create"}:
            return True
    return False


class MembershipService:
    def snapshot(self, user: CurrentUser) -> dict[str, Any]:
        self.sync_user(user)
        entitlement = self._entitlement_for_user(user)
        plan = self.effective_plan(entitlement)
        unlimited = plan != PLAN_FREE
        chats_used = store.count_chats_in_week(user.id, _iso_week_id())
        scans_used = store.count_documents(user.id)
        chats_cap = None if unlimited else FREE_CHAT_CAP
        scans_cap = None if unlimited else FREE_SCAN_CAP
        chats_remaining = None if unlimited else max(0, FREE_CHAT_CAP - chats_used)
        scans_remaining = None if unlimited else max(0, FREE_SCAN_CAP - scans_used)
        return {
            "plan": plan,
            "plan_label": PLAN_LABELS[plan],
            "unlimited": unlimited,
            "billing_status": (entitlement or {}).get("status") or "none",
            "plan_expires_at": (entitlement or {}).get("expires_at"),
            "chats_used": chats_used,
            "chats_cap": chats_cap if chats_cap is not None else FREE_CHAT_CAP,
            "chats_remaining": chats_remaining if chats_remaining is not None else FREE_CHAT_CAP,
            "scans_used": scans_used,
            "scans_cap": scans_cap if scans_cap is not None else FREE_SCAN_CAP,
            "scans_remaining": scans_remaining if scans_remaining is not None else FREE_SCAN_CAP,
            "email": user.email,
        }

    def effective_plan(self, entitlement: dict[str, Any] | None) -> str:
        if not entitlement:
            return PLAN_FREE
        plan = normalize_plan(entitlement.get("plan"))
        status = str(entitlement.get("status") or "active").lower()
        if status in _CANCELLED_STATUSES or status == "cancelled":
            return PLAN_FREE
        expires = _parse_dt(entitlement.get("expires_at"))
        if expires and expires <= _now():
            return PLAN_FREE
        if plan not in PAID_PLANS:
            return PLAN_FREE
        return plan

    def sync_user(self, user: CurrentUser) -> dict[str, Any] | None:
        email = (user.email or "").strip().lower()
        if not email:
            profile = store.get_profile(user.id)
            plan = normalize_plan((profile or {}).get("plan"))
            return {
                "email": None,
                "plan": plan,
                "status": (profile or {}).get("plan_status") or "none",
            }
        entitlement = store.get_entitlement_by_email(email)
        if entitlement:
            self._attach_user(user.id, email, entitlement)
            return entitlement
        return store.get_entitlement_by_email(email)

    def assert_can_chat(self, user: CurrentUser) -> dict[str, Any]:
        snap = self.snapshot(user)
        if snap["unlimited"]:
            return snap
        if snap["chats_used"] >= FREE_CHAT_CAP:
            raise PlanLimitError(
                f"Free plan: {FREE_CHAT_CAP} chats per week. You've used {snap['chats_used']}. "
                "Upgrade to Standard — $12/month — on Shopify.",
                kind="chat",
                used=snap["chats_used"],
                cap=FREE_CHAT_CAP,
            )
        return snap

    def assert_can_scan(self, user: CurrentUser, extra: int = 1) -> dict[str, Any]:
        snap = self.snapshot(user)
        if snap["unlimited"]:
            return snap
        if snap["scans_used"] + extra > FREE_SCAN_CAP:
            raise PlanLimitError(
                f"Free plan allows {FREE_SCAN_CAP} library items (notebook scans or lecture files). "
                f"You've used {snap['scans_used']}. "
                "Upgrade to Standard ($12/mo) on Shopify for unlimited.",
                kind="scan",
                used=snap["scans_used"],
                cap=FREE_SCAN_CAP,
            )
        return snap

    def apply_webhook(self, topic: str, payload: Any, shop_domain: str | None = None) -> str:
        normalized = topic.replace("_", "/").lower().strip("/")
        email = extract_email(payload)
        customer_id = extract_customer_id(payload)
        contract_id = extract_contract_id(payload)
        order_id = extract_order_id(payload)
        plan = extract_plan(payload)
        revoke = is_revoke_event(normalized, payload)

        existing = None
        if email:
            existing = store.get_entitlement_by_email(email)
        if existing is None and contract_id:
            existing = store.get_entitlement_by_contract(contract_id)
        if existing is None and customer_id:
            existing = store.get_entitlement_by_customer(customer_id)

        if not plan and existing:
            plan = normalize_plan(existing.get("plan"))

        if not email and existing:
            email = existing.get("email")

        if revoke:
            if not existing and not email:
                return "ignored"
            target_email = email or (existing or {}).get("email")
            if not target_email:
                return "ignored"
            if plan and existing and normalize_plan(existing.get("plan")) not in {plan, PLAN_FREE}:
                if contract_id and existing.get("shopify_contract_id") not in {None, contract_id}:
                    return "ignored_other_plan"
                if order_id and existing.get("shopify_order_id") not in {None, order_id} and not contract_id:
                    return "ignored_other_plan"
            saved = store.upsert_entitlement(
                target_email,
                {
                    "plan": PLAN_FREE,
                    "status": "cancelled",
                    "sku": (existing or {}).get("sku"),
                    "shopify_order_id": order_id or (existing or {}).get("shopify_order_id"),
                    "shopify_contract_id": contract_id or (existing or {}).get("shopify_contract_id"),
                    "shopify_customer_id": customer_id or (existing or {}).get("shopify_customer_id"),
                    "source": normalized,
                    "shop_domain": shop_domain,
                    "expires_at": _now_iso(),
                },
            )
            self._push_plan_to_account(target_email, saved)
            return "revoked"

        if not plan or plan == PLAN_FREE:
            return "ignored"
        if normalized == "orders/create":
            financial = str((payload or {}).get("financial_status") or "").lower()
            if financial and financial not in {"paid", "partially_paid"}:
                return "ignored_unpaid"
        if not email:
            return "ignored_no_email"

        expires = _now() + _duration_for_plan(plan)
        saved = store.upsert_entitlement(
            email,
            {
                "plan": plan,
                "status": "active",
                "sku": next(
                    (sku for sku, mapped in MEMBERSHIP_SKUS.items() if mapped == plan),
                    None,
                ),
                "shopify_order_id": order_id,
                "shopify_contract_id": contract_id,
                "shopify_customer_id": customer_id,
                "source": normalized,
                "shop_domain": shop_domain,
                "expires_at": expires.isoformat(),
            },
        )
        attached = self._push_plan_to_account(email, saved)
        return "plan_updated" if attached else "plan_pending_signup"

    def _entitlement_for_user(self, user: CurrentUser) -> dict[str, Any] | None:
        email = (user.email or "").strip().lower()
        if email:
            found = store.get_entitlement_by_email(email)
            if found:
                return found
        profile = store.get_profile(user.id)
        if not profile:
            return None
        return {
            "email": email or profile.get("email"),
            "plan": profile.get("plan") or PLAN_FREE,
            "status": profile.get("plan_status") or "none",
            "expires_at": profile.get("plan_expires_at"),
        }

    def _push_plan_to_account(self, email: str, entitlement: dict[str, Any]) -> bool:
        profile = store.get_profile_by_email(email)
        plan = self.effective_plan(entitlement)
        attached = False
        if profile:
            store.set_profile_plan(
                profile["id"],
                plan,
                status=entitlement.get("status") or "active",
                expires_at=entitlement.get("expires_at"),
            )
            if entitlement.get("shopify_customer_id"):
                store.upsert_shopify_customer(
                    profile["id"],
                    {
                        "shopify_customer_id": str(entitlement["shopify_customer_id"]),
                        "shop_domain": entitlement.get("shop_domain") or "sexb4g-xw.myshopify.com",
                        "email": email,
                    },
                )
            attached = True
        store.set_supabase_plan_by_email(
            email,
            plan,
            status=entitlement.get("status") or "active",
            expires_at=entitlement.get("expires_at"),
        )
        if store.find_supabase_user_id_by_email(email):
            attached = True
        return attached

    def _attach_user(self, user_id: str, email: str, entitlement: dict[str, Any]) -> None:
        plan = self.effective_plan(entitlement)
        store.set_profile_plan(
            user_id,
            plan,
            status=entitlement.get("status") or "active",
            expires_at=entitlement.get("expires_at"),
        )
        if entitlement.get("shopify_customer_id"):
            store.upsert_shopify_customer(
                user_id,
                {
                    "shopify_customer_id": str(entitlement["shopify_customer_id"]),
                    "shop_domain": entitlement.get("shop_domain") or "sexb4g-xw.myshopify.com",
                    "email": email,
                },
            )


membership_service = MembershipService()
