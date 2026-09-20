from __future__ import annotations

import base64
import hashlib
import hmac
import re
from typing import Any
from urllib.parse import urlencode
from uuid import uuid4

import httpx

from app.config import get_settings


class ShopifyClient:
    """Admin API + OAuth. Uses a saved shop install when the UI connects a store."""

    def __init__(self) -> None:
        pass

    @property
    def settings(self):
        return get_settings()

    @property
    def env_shop_domain(self) -> str | None:
        return _normalize_shop_domain(self.settings.shopify_store_url, required=False)

    @property
    def shop_domain(self) -> str | None:
        domain, _token, _method = self._credentials()
        return domain

    @property
    def has_oauth_app(self) -> bool:
        return bool(self.settings.shopify_client_id and self.settings.shopify_client_secret)

    @property
    def has_admin_token(self) -> bool:
        _domain, token, _method = self._credentials()
        return bool(token)

    @property
    def configured(self) -> bool:
        return self.has_admin_token or self.has_oauth_app

    def status(self) -> dict[str, Any]:
        domain, token, method = self._credentials()
        install = _safe_install()
        return {
            "configured": bool(token) or self.has_oauth_app,
            "connected": bool(token and domain),
            "mode": "live" if token else "disconnected",
            "connection_method": method if token else None,
            "shop_domain": domain,
            "shop_name": (install or {}).get("shop_name"),
            "has_oauth_app": self.has_oauth_app,
            "has_admin_token": bool(token),
            "has_webhook_secret": bool(self.settings.shopify_webhook_secret),
            "oauth_redirect_uri": self.settings.oauth_redirect_uri,
            "oauth_scopes": self.settings.shopify_oauth_scopes,
        }

    def oauth_authorize_url(self, shop: str, state: str) -> str:
        if not self.has_oauth_app:
            raise RuntimeError(
                "Shopify-appen saknar Client ID/Secret. "
                "Sätt SHOPIFY_CLIENT_ID och SHOPIFY_CLIENT_SECRET, "
                "eller klistra in en Admin API-token i stället."
            )
        domain = _normalize_shop_domain(shop)
        query = urlencode(
            {
                "client_id": self.settings.shopify_client_id,
                "scope": self.settings.shopify_oauth_scopes,
                "redirect_uri": self.settings.oauth_redirect_uri,
                "state": state,
            }
        )
        return f"https://{domain}/admin/oauth/authorize?{query}"

    def verify_oauth_query(self, params: dict[str, str]) -> bool:
        secret = self.settings.shopify_client_secret
        hmac_value = params.get("hmac")
        if not secret or not hmac_value:
            return not bool(secret)
        message = "&".join(
            f"{key}={value}"
            for key, value in sorted(params.items())
            if key not in {"hmac", "signature"}
        )
        digest = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()
        return hmac.compare_digest(digest, hmac_value)

    def exchange_code_for_token(self, shop: str, code: str) -> dict[str, Any]:
        if not self.has_oauth_app:
            return {
                "access_token": None,
                "mode": "mock",
                "detail": "OAuth-byte kräver SHOPIFY_CLIENT_ID och SHOPIFY_CLIENT_SECRET.",
            }
        domain = _normalize_shop_domain(shop)
        with httpx.Client(timeout=20.0) as http:
            response = http.post(
                f"https://{domain}/admin/oauth/access_token",
                json={
                    "client_id": self.settings.shopify_client_id,
                    "client_secret": self.settings.shopify_client_secret,
                    "code": code,
                },
            )
        response.raise_for_status()
        return response.json()

    def describe_shop(self, shop: str, access_token: str) -> dict[str, Any]:
        domain = _normalize_shop_domain(shop)
        payload = self._admin_with(
            domain,
            access_token,
            "GET",
            "shop.json",
        )
        shop_data = (payload or {}).get("shop") or {}
        if not shop_data:
            raise RuntimeError("Shopify svarade inte med butiksdata. Kontrollera token och butiksnamn.")
        return {
            "shop_domain": shop_data.get("myshopify_domain") or domain,
            "shop_name": shop_data.get("name"),
            "email": shop_data.get("email"),
            "currency": shop_data.get("currency"),
        }

    def find_or_create_customer(
        self,
        email: str | None,
        display_name: str | None = None,
        shopify_customer_id: str | None = None,
    ) -> dict[str, Any]:
        domain, token, method = self._credentials()
        live = bool(domain and token)
        if shopify_customer_id and live:
            live_payload = self._admin("GET", f"customers/{shopify_customer_id}.json")
            customer = (live_payload or {}).get("customer")
            if customer:
                return _customer_payload(customer, source="shopify", shop_domain=domain)
        if email and live:
            found = self._admin("GET", "customers/search.json", params={"query": f"email:{email}"})
            customers = (found or {}).get("customers") or []
            if customers:
                return _customer_payload(customers[0], source="shopify", shop_domain=domain)
            created = self._admin(
                "POST",
                "customers.json",
                json_body={
                    "customer": {
                        "email": email,
                        "first_name": display_name or "Plugga",
                        "tags": "plugga-app",
                    }
                },
            )
            customer = (created or {}).get("customer")
            if customer:
                return _customer_payload(customer, source="shopify", shop_domain=domain)
        if live:
            raise RuntimeError("Kunde inte hitta eller skapa Shopify-kunden. Kontrollera e-postadressen.")
        del method
        return {
            "id": shopify_customer_id or f"mock-{uuid4()}",
            "email": email,
            "display_name": display_name,
            "shop_domain": domain or "mock.myshopify.com",
            "source": "mock",
        }

    def list_products(self, limit: int = 8) -> list[dict[str, Any]]:
        if self.has_admin_token:
            payload = self._admin("GET", "products.json", params={"limit": str(limit)})
            products = (payload or {}).get("products") or []
            return [_product_payload(product) for product in products]
        return []

    def create_checkout(
        self,
        variant_id: str,
        quantity: int,
        customer_id: str | None,
    ) -> dict[str, Any]:
        if not self.has_admin_token:
            raise RuntimeError("Koppla en Shopify-butik innan checkout.")
        if variant_id.startswith("gid://"):
            variant_id = variant_id.rsplit("/", 1)[-1]
        try:
            variant_ref: str | int = int(variant_id)
        except ValueError:
            variant_ref = variant_id
        body: dict[str, Any] = {
            "draft_order": {
                "line_items": [{"variant_id": variant_ref, "quantity": quantity}],
            }
        }
        if customer_id and not str(customer_id).startswith("mock-"):
            body["draft_order"]["customer"] = {"id": customer_id}
        payload = self._admin("POST", "draft_orders.json", json_body=body)
        draft = (payload or {}).get("draft_order") or {}
        return {
            "id": draft.get("id"),
            "invoice_url": draft.get("invoice_url"),
            "status": draft.get("status") or "open",
            "source": "shopify",
        }

    def verify_webhook(self, body: bytes, hmac_header: str | None) -> bool:
        secret = self.settings.shopify_webhook_secret
        if not secret or not hmac_header:
            return False
        digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
        computed = base64.b64encode(digest).decode("utf-8")
        return hmac.compare_digest(computed, hmac_header)

    def _credentials(self) -> tuple[str | None, str | None, str | None]:
        install = _safe_install()
        if install and install.get("access_token") and install.get("shop_domain"):
            return (
                str(install["shop_domain"]),
                str(install["access_token"]),
                str(install.get("connection_method") or "oauth"),
            )
        if self.settings.shopify_admin_api_token and self.env_shop_domain:
            return (
                self.env_shop_domain,
                self.settings.shopify_admin_api_token,
                "env",
            )
        return None, None, None

    def _admin(
        self,
        method: str,
        path: str,
        params: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        domain, token, _method = self._credentials()
        if not domain or not token:
            return None
        return self._admin_with(domain, token, method, path, params, json_body)

    def _admin_with(
        self,
        shop_domain: str,
        access_token: str,
        method: str,
        path: str,
        params: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        url = f"https://{shop_domain}/admin/api/{self.settings.shopify_api_version}/{path}"
        headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=20.0, follow_redirects=True) as http:
            response = http.request(
                method,
                url,
                headers=headers,
                params=params,
                json=json_body,
            )
        if response.status_code in {401, 403, 404}:
            raise RuntimeError(
                f"Shopify avvisade anropet ({response.status_code}). "
                "Kontrollera butik, token och app-scopes."
            )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"Shopify-anropet misslyckades ({exc.response.status_code})."
            ) from exc
        return response.json() if response.content else {}


def normalize_shop_domain(value: str) -> str:
    return _normalize_shop_domain(value)


def _normalize_shop_domain(value: str | None, required: bool = True) -> str | None:
    raw = (value or "").strip().lower()
    if not raw:
        if required:
            raise ValueError("Ange butiken, t.ex. mystore.myshopify.com")
        return None
    raw = raw.replace("https://", "").replace("http://", "").split("/")[0]
    raw = raw.split(":")[0]
    if "." not in raw:
        raw = f"{raw}.myshopify.com"
    if not re.fullmatch(r"[a-z0-9][a-z0-9\-]*\.myshopify\.com", raw):
        raise ValueError("Använd butikens myshopify.com-adress, t.ex. mystore.myshopify.com")
    return raw


def _safe_install() -> dict[str, Any] | None:
    from app.services.store import store

    return store.get_active_shopify_install()


def _customer_payload(
    customer: dict[str, Any],
    source: str,
    shop_domain: str | None = None,
) -> dict[str, Any]:
    return {
        "id": str(customer.get("id")),
        "email": customer.get("email"),
        "display_name": customer.get("first_name") or customer.get("display_name"),
        "shop_domain": shop_domain or customer.get("shop_domain"),
        "source": source,
    }


def _product_payload(product: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(product.get("id")),
        "title": product.get("title"),
        "status": product.get("status"),
        "variants": [
            {
                "id": str(variant.get("id")),
                "title": variant.get("title"),
                "price": variant.get("price"),
            }
            for variant in product.get("variants") or []
        ],
    }


shopify_client = ShopifyClient()
