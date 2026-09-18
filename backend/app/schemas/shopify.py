from pydantic import BaseModel, Field


class LinkCustomerRequest(BaseModel):
    email: str | None = None
    shopify_customer_id: str | None = None
    shop_domain: str | None = None
    display_name: str | None = None


class CheckoutRequest(BaseModel):
    variant_id: str
    quantity: int = Field(default=1, ge=1, le=10)


class ShopifyStatusResponse(BaseModel):
    configured: bool
    mode: str
    shop_domain: str | None = None
    has_oauth_app: bool
    has_admin_token: bool
    has_webhook_secret: bool
    linked_customer: dict | None = None
