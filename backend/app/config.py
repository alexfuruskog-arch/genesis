from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "ARZIVE API"
    frontend_origin: str = "http://127.0.0.1:43123"

    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None

    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    llm_provider: str = "auto"
    llm_model: str | None = None

    shopify_store_url: str | None = None
    shopify_client_id: str | None = None
    shopify_client_secret: str | None = None
    shopify_admin_api_token: str | None = None
    shopify_webhook_secret: str | None = None
    shopify_api_version: str = "2025-01"
    shopify_oauth_scopes: str = (
        "read_customers,write_customers,read_products,write_draft_orders"
    )
    shopify_oauth_redirect_uri: str = (
        "http://127.0.0.1:43123/shopify/callback"
    )

    local_upload_dir: str = ".local_uploads"
    local_shopify_install_path: str = ".local_shopify_install.json"
    max_upload_bytes: int = 10 * 1024 * 1024
    embedding_dimensions: int = 1536

    @property
    def supabase_enabled(self) -> bool:
        return bool(
            self.supabase_url
            and (self.supabase_service_role_key or self.supabase_anon_key)
        )

    @property
    def supabase_key(self) -> str | None:
        return self.supabase_service_role_key or self.supabase_anon_key

    @property
    def oauth_redirect_uri(self) -> str:
        return (self.shopify_oauth_redirect_uri or "").strip() or (
            self.frontend_origin.rstrip("/") + "/shopify/callback"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
