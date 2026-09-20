from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, documents, health, membership, quizzes, shopify

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="ARZIVE — notebooks in the shop, Study with Arzive for scanned notes and AI practice.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_origin,
        "http://127.0.0.1:43123",
        "http://localhost:43123",
        "http://0.0.0.0:43123",
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(membership.router)
app.include_router(documents.router)
app.include_router(quizzes.router)
app.include_router(shopify.router)
