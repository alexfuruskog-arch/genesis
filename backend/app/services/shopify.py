from __future__ import annotations

import base64
import hashlib
import hmac
from typing import Any
from urllib.parse import urlencode
from uuid import uuid4

import httpx

from app.config import get_settings


class ShopifyClient:
    """Admin API + OAuth helpers. Mocks catalog/checkout when secrets are missing."""

    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def shop_domain(self) -> str | None:
        raw = (self.settings.shopify_store_url or "").strip()
        if not raw:
            return None
        return (
            raw.replace("https://", "")
            .replace("http://", "")
            .split("/")[0]
            .lower()
        )

    @property
    def has_oauth_app(self) -> bool:
        return bool(self.settings.shopify_client_id and self.settings.shopify_client_secret)

    @property
    def has_admin_token(self) -> bool:
        return bool(self.settings.shopify_admin_api_token and self.shop_domain)

    @property
    def configured(self) -> bool:
        return self.has_admin_token or self.has_oauth_app

    def status(self) -> dict[str, Any]:
        return {
            "configured": self.configured,
            "mode": "live" if self.has_admin_token else "mock",
            "shop_domain": self.shop_domain,
            "has_oauth_app": self.has_oauth_app,
            "has_admin_token": self.has_admin_token,
            "has_webhook_secret": bool(self.settings.shopify_webhook_secret),
        }

    def oauth_authorize_url(self, shop: str, state: str) -> str:
        if not self.has_oauth_app:
            raise RuntimeError("Shopify OAuth-app (client id/secret) saknas.")
        domain = shop.replace("https://", "").replace("http://", "").split("/")[0]
        query = urlencode(
            {
                "client_id": self.settings.shopify_client_id,
                "scope": self.settings.shopify_oauth_scopes,
                "redirect_uri": self.settings.shopify_oauth_redirect_uri,
                "state": state,
            }
        )
        return f"https://{domain}/admin/oauth/authorize?{query}"

    def exchange_code_for_token(self, shop: str, code: str) -> dict[str, Any]:
        if not self.has_oauth_app:
            return {
                "access_token": None,
                "mode": "mock",
                "detail": "OAuth-byte kräver SHOPIFY_CLIENT_ID och SHOPIFY_CLIENT_SECRET.",
            }
        domain = shop.replace("https://", "").replace("http://", "").split("/")[0]
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

    def find_or_create_customer(
        self,
        email: str | None,
        display_name: str | None = None,
        shopify_customer_id: str | None = None,
    ) -> dict[str, Any]:
        if shopify_customer_id and self.has_admin_token:
            live = self._admin("GET", f"customers/{shopify_customer_id}.json")
            customer = (live or {}).get("customer")
            if customer:
                return _customer_payload(customer, source="shopify")
        if email and self.has_admin_token:
            found = self._admin("GET", "customers/search.json", params={"query": f"email:{email}"})
            customers = (found or {}).get("customers") or []
            if customers:
                return _customer_payload(customers[0], source="shopify")
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
                return _customer_payload(customer, source="shopify")
        return {
            "id": shopify_customer_id or f"mock-{uuid4()}",
            "email": email,
            "display_name": display_name,
            "shop_domain": self.shop_domain or "mock.myshopify.com",
            "source": "mock",
        }

    def list_products(self, limit: int = 8) -> list[dict[str, Any]]:
        if self.has_admin_token:
            payload = self._admin("GET", "products.json", params={"limit": str(limit)})
            products = (payload or {}).get("products") or []
            return [_product_payload(product) for product in products]
        return [
            {
                "id": "mock-product-plus",
                "title": "Plugga Plus — tentapaket",
                "status": "active",
                "variants": [
                    {"id": "mock-variant-plus", "title": "Digital tillgång", "price": "79.00"}
                ],
            },
            {
                "id": "mock-product-notes",
                "title": "Plugga anteckningsblock",
                "status": "active",
                "variants": [
                    {"id": "mock-variant-notes", "title": "Fysiskt block", "price": "129.00"}
                ],
            },
        ]

    def create_checkout(
        self,
        variant_id: str,
        quantity: int,
        customer_id: str | None,
    ) -> dict[str, Any]:
        if self.has_admin_token:
            body: dict[str, Any] = {
                "draft_order": {
                    "line_items": [{"variant_id": variant_id, "quantity": quantity}],
                }
            }
            if customer_id and not customer_id.startswith("mock-"):
                body["draft_order"]["customer"] = {"id": customer_id}
            payload = self._admin("POST", "draft_orders.json", json_body=body)
            draft = (payload or {}).get("draft_order") or {}
            return {
                "id": draft.get("id"),
                "invoice_url": draft.get("invoice_url"),
                "status": draft.get("status") or "open",
                "source": "shopify",
            }
        return {
            "id": f"mock-draft-{uuid4()}",
            "invoice_url": None,
            "status": "open",
            "source": "mock",
            "detail": (
                "Draft order skapas mot Shopify Admin API när SHOPIFY_ADMIN_API_TOKEN "
                "och SHOPIFY_STORE_URL är satta. Använd invoice_url som checkout."
            ),
            "variant_id": variant_id,
            "quantity": quantity,
            "customer_id": customer_id,
        }

    def verify_webhook(self, body: bytes, hmac_header: str | None) -> bool:
        secret = self.settings.shopify_webhook_secret
        if not secret or not hmac_header:
            return False
        digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
        computed = base64.b64encode(digest).decode("utf-8")
        return hmac.compare_digest(computed, hmac_header)

    def _admin(
        self,
        method: str,
        path: str,
        params: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        if not self.has_admin_token or not self.shop_domain:
            return None
        url = f"https://{self.shop_domain}/admin/api/{self.settings.shopify_api_version}/{path}"
        headers = {
            "X-Shopify-Access-Token": self.settings.shopify_admin_api_token or "",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=20.0) as http:
            response = http.request(
                method,
                url,
                headers=headers,
                params=params,
                json=json_body,
            )
        response.raise_for_status()
        return response.json() if response.content else {}


def _customer_payload(customer: dict[str, Any], source: str) -> dict[str, Any]:
    return {
        "id": str(customer.get("id")),
        "email": customer.get("email"),
        "display_name": customer.get("first_name") or customer.get("display_name"),
        "shop_domain": customer.get("shop_domain"),
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
