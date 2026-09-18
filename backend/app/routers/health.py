from fastapi import APIRouter

from app.config import get_settings
from app.services.llm import llm_client
from app.services.shopify import shopify_client

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "service": "plugga-api",
        "integrations": {
            "supabase": settings.supabase_enabled,
            "llm": llm_client.provider_name,
            "shopify": shopify_client.status()["mode"],
        },
    }


@router.get("/hello")
def hello() -> dict:
    return {
        "message": "Hej från Plugga. Ladda upp anteckningar och få quiz."
    }
