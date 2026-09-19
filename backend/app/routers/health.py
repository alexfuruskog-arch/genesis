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
        "service": "arzive-api",
        "integrations": {
            "supabase": settings.supabase_enabled,
            "llm": llm_client.provider_name,
            "shopify": shopify_client.status()["mode"],
        },
    }


@router.get("/hello")
def hello() -> dict:
    return {
        "message": "Hello from ARZIVE. Scan notebook pages and generate practice exams or flashcards."
    }
