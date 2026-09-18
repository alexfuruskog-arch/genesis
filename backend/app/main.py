from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import documents, health, quizzes, shopify

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Plugga — ladda upp anteckningar och generera studiequiz.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_origin,
        "http://127.0.0.1:43123",
        "http://localhost:43123",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(documents.router)
app.include_router(quizzes.router)
app.include_router(shopify.router)
