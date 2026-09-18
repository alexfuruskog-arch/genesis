from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

from app.deps import CurrentUser, get_current_user
from app.schemas.shopify import CheckoutRequest, LinkCustomerRequest, ShopifyStatusResponse
from app.services.shopify import shopify_client
from app.services.store import store

router = APIRouter(prefix="/shopify", tags=["shopify"])


@router.get("/status", response_model=ShopifyStatusResponse)
def shopify_status(user: CurrentUser = Depends(get_current_user)) -> ShopifyStatusResponse:
    linked = store.get_shopify_customer(user.id)
    return ShopifyStatusResponse(
        **shopify_client.status(),
        linked_customer=linked,
    )


@router.get("/oauth/install")
def oauth_install(
    shop: str = Query(..., description="mystore.myshopify.com"),
) -> dict[str, Any]:
    state = str(uuid4())
    try:
        url = shopify_client.oauth_authorize_url(shop, state)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"authorize_url": url, "state": state, "shop": shop}


@router.get("/oauth/callback")
def oauth_callback(
    shop: str | None = None,
    code: str | None = None,
    state: str | None = None,
) -> dict[str, Any]:
    if not shop or not code:
        raise HTTPException(status_code=400, detail="shop och code krävs från Shopify.")
    token = shopify_client.exchange_code_for_token(shop, code)
    return {
        "shop": shop,
        "state": state,
        "token_payload": {
            key: token.get(key)
            for key in ("scope", "associated_user_scope")
            if key in token
        },
        "has_access_token": bool(token.get("access_token")),
        "mode": token.get("mode", "live"),
        "next": "Spara access_token som SHOPIFY_ADMIN_API_TOKEN för den här butiken.",
    }


@router.post("/customers/link")
def link_customer(
    payload: LinkCustomerRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    customer = shopify_client.find_or_create_customer(
        email=payload.email,
        display_name=payload.display_name,
        shopify_customer_id=payload.shopify_customer_id,
    )
    saved = store.upsert_shopify_customer(
        user.id,
        {
            "shopify_customer_id": str(customer["id"]),
            "shop_domain": payload.shop_domain
            or customer.get("shop_domain")
            or shopify_client.shop_domain
            or "mock.myshopify.com",
            "email": payload.email or customer.get("email"),
        },
    )
    return {"link": saved, "shopify_customer": customer}


@router.get("/products")
def list_products(user: CurrentUser = Depends(get_current_user)) -> dict[str, Any]:
    del user
    return {
        "mode": shopify_client.status()["mode"],
        "products": shopify_client.list_products(),
    }


@router.post("/checkout")
def create_checkout(
    payload: CheckoutRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    linked = store.get_shopify_customer(user.id)
    customer_id = linked.get("shopify_customer_id") if linked else None
    checkout = shopify_client.create_checkout(
        variant_id=payload.variant_id,
        quantity=payload.quantity,
        customer_id=customer_id,
    )
    return {"checkout": checkout, "linked_customer": linked}


@router.post("/webhooks/{topic:path}")
async def shopify_webhook(
    topic: str,
    request: Request,
    x_shopify_hmac_sha256: str | None = Header(default=None, alias="X-Shopify-Hmac-Sha256"),
    x_shopify_shop_domain: str | None = Header(default=None, alias="X-Shopify-Shop-Domain"),
) -> dict[str, Any]:
    body = await request.body()
    verified = shopify_client.verify_webhook(body, x_shopify_hmac_sha256)
    payload: Any
    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        payload = {"raw": body.decode("utf-8", errors="replace")}

    handled = _handle_webhook(topic, payload, x_shopify_shop_domain)
    store.record_webhook(
        {
            "topic": topic,
            "shop_domain": x_shopify_shop_domain,
            "verified": verified,
            "handled": handled,
        }
    )
    return {
        "ok": True,
        "topic": topic,
        "verified": verified,
        "handled": handled,
        "shop_domain": x_shopify_shop_domain,
    }


@router.get("/webhooks/recent")
def recent_webhooks(user: CurrentUser = Depends(get_current_user)) -> dict[str, Any]:
    del user
    return {"events": store.recent_webhooks()}


def _handle_webhook(topic: str, payload: Any, shop_domain: str | None) -> str:
    normalized = topic.replace("_", "/")
    if normalized in {"customers/create", "customers/update", "customers/data_request"}:
        customer_id = str((payload or {}).get("id") or "")
        email = (payload or {}).get("email")
        if customer_id or email:
            return "customer_sync_placeholder"
        return "ignored"
    if normalized in {"orders/paid", "orders/create"}:
        return "entitlement_placeholder"
    if normalized in {"app/uninstalled", "shop/update"}:
        return "shop_lifecycle_placeholder"
    del shop_domain
    return "recorded"
