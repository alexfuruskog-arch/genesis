from pydantic import BaseModel, Field


class LinkCustomerRequest(BaseModel):
    email: str | None = None
    shopify_customer_id: str | None = None
    shop_domain: str | None = None
    display_name: str | None = None


class CheckoutRequest(BaseModel):
    variant_id: str
    quantity: int = Field(default=1, ge=1, le=10)


class ConnectShopRequest(BaseModel):
    shop: str
    admin_api_token: str | None = None


class OAuthCompleteRequest(BaseModel):
    shop: str
    code: str
    state: str | None = None
    hmac: str | None = None


class ShopifyStatusResponse(BaseModel):
    configured: bool
    connected: bool = False
    mode: str
    connection_method: str | None = None
    shop_domain: str | None = None
    shop_name: str | None = None
    has_oauth_app: bool
    has_admin_token: bool
    has_webhook_secret: bool
    oauth_redirect_uri: str | None = None
    oauth_scopes: str | None = None
    linked_customer: dict | None = None
