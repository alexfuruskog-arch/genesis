from __future__ import annotations

import base64
import hashlib
import hmac
import json

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.services.membership import extract_plan, membership_service, plan_from_sku_or_text


client = TestClient(app)

STANDARD_ORDER = {
    "id": 1001,
    "email": "buyer@arzive.org",
    "financial_status": "paid",
    "customer": {"id": 77, "email": "buyer@arzive.org"},
    "line_items": [
        {
            "sku": "ARZ-MEM-STANDARD",
            "title": "Study Standard Membership",
            "quantity": 1,
        }
    ],
}


def _hmac(secret: str, body: bytes) -> str:
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


def test_sku_and_handle_map_to_plans():
    assert plan_from_sku_or_text("ARZ-MEM-STANDARD") == "standard"
    assert plan_from_sku_or_text("membership-annual") == "annual"
    assert plan_from_sku_or_text("Study Scholar Membership") == "scholar"
    assert extract_plan(STANDARD_ORDER) == "standard"
    assert extract_plan({"line_items": [{"title": "Cornell Notebook", "sku": "ARZ-CORNELL-A4-OW"}]}) is None


def test_paid_order_webhook_then_signup_unlocks_standard():
    response = client.post(
        "/shopify/webhooks/orders/paid",
        json=STANDARD_ORDER,
        headers={"X-Shopify-Shop-Domain": "sexb4g-xw.myshopify.com"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["handled"] == "plan_pending_signup"
    assert body["mode"] == "mock"
    assert body["verified"] is False

    signup = client.post(
        "/auth/signup",
        json={"email": "buyer@arzive.org", "password": "secret12"},
    )
    assert signup.status_code == 200
    session = signup.json()
    assert session["plan"] == "standard"
    assert session["unlimited"] is True

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {session['token']}"})
    assert me.status_code == 200
    assert me.json()["plan"] == "standard"


def test_existing_study_user_is_updated_immediately():
    signup = client.post(
        "/auth/signup",
        json={"email": "already@arzive.org", "password": "secret12"},
    )
    token = signup.json()["token"]
    assert signup.json()["plan"] == "free"

    order = {
        **STANDARD_ORDER,
        "email": "already@arzive.org",
        "customer": {"id": 88, "email": "already@arzive.org"},
    }
    paid = client.post("/shopify/webhooks", json=order, headers={"X-Shopify-Topic": "orders/paid"})
    assert paid.json()["handled"] == "plan_updated"

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["plan"] == "standard"


def test_cancel_drops_back_to_free():
    client.post("/shopify/webhooks/orders/paid", json=STANDARD_ORDER)
    signup = client.post(
        "/auth/signup",
        json={"email": "buyer@arzive.org", "password": "secret12"},
    )
    token = signup.json()["token"]
    assert signup.json()["plan"] == "standard"

    cancelled = {**STANDARD_ORDER, "cancelled_at": "2026-09-20T12:00:00Z"}
    response = client.post("/shopify/webhooks/orders/cancelled", json=cancelled)
    assert response.json()["handled"] == "revoked"

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["plan"] == "free"
    assert me.json()["unlimited"] is False


def test_hmac_required_when_secret_set(monkeypatch):
    monkeypatch.setenv("SHOPIFY_WEBHOOK_SECRET", "shop-secret")
    get_settings.cache_clear()
    body = json.dumps(STANDARD_ORDER).encode("utf-8")
    denied = client.post(
        "/shopify/webhooks/orders/paid",
        content=body,
        headers={"Content-Type": "application/json"},
    )
    assert denied.status_code == 401

    accepted = client.post(
        "/shopify/webhooks/orders/paid",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Shopify-Hmac-Sha256": _hmac("shop-secret", body),
        },
    )
    assert accepted.status_code == 200
    assert accepted.json()["verified"] is True
    get_settings.cache_clear()


def test_free_chat_cap_enforced():
    signup = client.post(
        "/auth/signup",
        json={"email": "free@arzive.org", "password": "secret12"},
    )
    token = signup.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    uploaded_ids = []
    for index in range(2):
        upload = client.post(
            "/upload-document",
            headers=headers,
            files={"file": (f"notes-{index}.txt", b"Photosynthesis occurs in chloroplasts. Light reaction.", "text/plain")},
            data={"notebook_model": "cornell"},
        )
        assert upload.status_code == 200, upload.text
        uploaded_ids.append(upload.json()["id"])

    for _ in range(3):
        generated = client.post(
            "/generate-study",
            headers=headers,
            json={"document_ids": uploaded_ids, "output_type": "quiz", "question_count": 1},
        )
        assert generated.status_code == 200, generated.text

    blocked = client.post(
        "/generate-study",
        headers=headers,
        json={"document_ids": uploaded_ids, "output_type": "quiz", "question_count": 1},
    )
    assert blocked.status_code == 403
    assert "3 chats" in blocked.json()["detail"]


def test_entitlement_stored_for_later_signup():
    from app.services.store import store

    result = membership_service.apply_webhook(
        "orders/paid", STANDARD_ORDER, "sexb4g-xw.myshopify.com"
    )
    assert result == "plan_pending_signup"
    row = store.get_entitlement_by_email("buyer@arzive.org")
    assert row is not None
    assert row["plan"] == "standard"
    assert row["status"] == "active"
