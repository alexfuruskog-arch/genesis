from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from app.config import get_settings
from app.deps import CurrentUser, get_current_user
from app.schemas.shopify import (
    CheckoutRequest,
    ConnectShopRequest,
    LinkCustomerRequest,
    OAuthCompleteRequest,
    ShopifyStatusResponse,
)
from app.services.shopify import normalize_shop_domain, shopify_client
from app.services.store import store

router = APIRouter(prefix="/shopify", tags=["shopify"])


@router.get("/status", response_model=ShopifyStatusResponse)
def shopify_status(user: CurrentUser = Depends(get_current_user)) -> ShopifyStatusResponse:
    linked = store.get_shopify_customer(user.id)
    return ShopifyStatusResponse(
        **shopify_client.status(),
        linked_customer=linked,
    )


@router.post("/connect")
def connect_shop(
    payload: ConnectShopRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        shop = normalize_shop_domain(payload.shop)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    token = (payload.admin_api_token or "").strip()
    if token:
        try:
            info = shopify_client.describe_shop(shop, token)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        saved = _persist_install(
            shop_domain=info["shop_domain"],
            access_token=token,
            method="admin_token",
            shop_name=info.get("shop_name"),
            scope=None,
        )
        return {
            "connected": True,
            "method": "admin_token",
            "install": _public_install(saved),
            "user_id": user.id,
        }

    if shopify_client.has_oauth_app:
        state = str(uuid4())
        store.put_oauth_state(
            state,
            {
                "shop": shop,
                "user_id": user.id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        url = shopify_client.oauth_authorize_url(shop, state)
        return {
            "connected": False,
            "method": "oauth",
            "authorize_url": url,
            "state": state,
            "shop": shop,
            "redirect_uri": get_settings().oauth_redirect_uri,
        }

    raise HTTPException(
        status_code=400,
        detail=(
            "Ingen Shopify-koppling är konfigurerad. Klistra in en Admin API-token "
            "från en custom app, eller sätt SHOPIFY_CLIENT_ID och SHOPIFY_CLIENT_SECRET "
            "för OAuth."
        ),
    )


@router.post("/disconnect")
def disconnect_shop(user: CurrentUser = Depends(get_current_user)) -> dict[str, Any]:
    del user
    store.clear_shopify_installs()
    return {"connected": False, "mode": shopify_client.status()["mode"]}


@router.get("/oauth/install")
def oauth_install(
    shop: str = Query(..., description="mystore.myshopify.com"),
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return connect_shop(ConnectShopRequest(shop=shop), user)


@router.get("/oauth/callback")
def oauth_callback(
    request: Request,
    shop: str | None = None,
    code: str | None = None,
    state: str | None = None,
    hmac: str | None = None,
) -> RedirectResponse:
    settings = get_settings()
    try:
        _complete_oauth(
            shop=shop or "",
            code=code or "",
            state=state,
            hmac=hmac,
            query={key: value for key, value in request.query_params.items()},
        )
        target = f"{settings.frontend_origin.rstrip('/')}/?shopify=connected"
    except HTTPException as exc:
        target = (
            f"{settings.frontend_origin.rstrip('/')}/?shopify=error"
            f"&detail={exc.detail}"
        )
    return RedirectResponse(target, status_code=302)


@router.post("/oauth/complete")
def oauth_complete(
    payload: OAuthCompleteRequest,
    request: Request,
) -> dict[str, Any]:
    query = {key: value for key, value in request.query_params.items() if value}
    for key, value in (
        ("shop", payload.shop),
        ("code", payload.code),
        ("state", payload.state),
        ("hmac", payload.hmac),
    ):
        if value and key not in query:
            query[key] = value
    install = _complete_oauth(
        shop=payload.shop,
        code=payload.code,
        state=payload.state,
        hmac=payload.hmac,
        query=query,
    )
    return {"connected": True, "method": "oauth", "install": _public_install(install)}


@router.post("/customers/link")
def link_customer(
    payload: LinkCustomerRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    if not shopify_client.status()["connected"]:
        raise HTTPException(status_code=400, detail="Koppla en Shopify-butik först.")
    if not payload.email and not payload.shopify_customer_id:
        raise HTTPException(status_code=400, detail="Ange e-post eller Shopify customer id.")
    try:
        customer = shopify_client.find_or_create_customer(
            email=payload.email,
            display_name=payload.display_name,
            shopify_customer_id=payload.shopify_customer_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
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
    try:
        products = shopify_client.list_products()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    status = shopify_client.status()
    return {
        "mode": status["mode"],
        "connected": status["connected"],
        "products": products,
    }


@router.post("/checkout")
def create_checkout(
    payload: CheckoutRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    linked = store.get_shopify_customer(user.id)
    customer_id = linked.get("shopify_customer_id") if linked else None
    try:
        checkout = shopify_client.create_checkout(
            variant_id=payload.variant_id,
            quantity=payload.quantity,
            customer_id=customer_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
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


def _complete_oauth(
    shop: str,
    code: str,
    state: str | None,
    hmac: str | None,
    query: dict[str, str],
) -> dict[str, Any]:
    del hmac
    if not shop or not code:
        raise HTTPException(status_code=400, detail="shop och code krävs från Shopify.")
    if not shopify_client.verify_oauth_query({k: v for k, v in query.items() if v}):
        raise HTTPException(status_code=400, detail="Shopify HMAC kunde inte verifieras.")
    recorded = store.pop_oauth_state(state or "") if state else None
    if state and recorded is None:
        raise HTTPException(status_code=400, detail="OAuth-state saknas eller är redan använd.")
    try:
        domain = normalize_shop_domain(shop)
        token_payload = shopify_client.exchange_code_for_token(domain, code)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"OAuth-byte misslyckades: {exc}") from exc
    access_token = token_payload.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=400,
            detail=token_payload.get("detail") or "Shopify returnerade ingen access token.",
        )
    try:
        info = shopify_client.describe_shop(domain, access_token)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _persist_install(
        shop_domain=info["shop_domain"],
        access_token=access_token,
        method="oauth",
        shop_name=info.get("shop_name"),
        scope=token_payload.get("scope"),
    )


def _persist_install(
    shop_domain: str,
    access_token: str,
    method: str,
    shop_name: str | None,
    scope: str | None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    return store.save_shopify_install(
        {
            "id": str(uuid4()),
            "shop_domain": shop_domain,
            "access_token": access_token,
            "scope": scope,
            "connection_method": method,
            "shop_name": shop_name,
            "is_active": True,
            "updated_at": now,
            "created_at": now,
        }
    )


def _public_install(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "shop_domain": row.get("shop_domain"),
        "shop_name": row.get("shop_name"),
        "connection_method": row.get("connection_method"),
        "scope": row.get("scope"),
        "is_active": row.get("is_active"),
    }


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
        if normalized == "app/uninstalled":
            store.clear_shopify_installs()
            return "shop_uninstalled"
        return "shop_lifecycle_placeholder"
    del shop_domain
    return "recorded"
