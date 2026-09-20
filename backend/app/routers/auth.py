from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException

from app.deps import CurrentUser, get_current_user
from app.schemas.auth import AuthCredentials, AuthSessionResponse, AuthUserResponse
from app.services.auth import auth_service
from app.services.membership import membership_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _bearer_token(authorization: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return None


def _with_plan(payload: dict) -> dict:
    snap = membership_service.snapshot(
        CurrentUser(
            id=payload["id"],
            email=payload.get("email"),
            source=payload.get("source") or "local",
        )
    )
    return {**payload, **{k: snap[k] for k in (
        "plan",
        "plan_label",
        "unlimited",
        "billing_status",
        "plan_expires_at",
        "chats_used",
        "chats_cap",
        "chats_remaining",
        "scans_used",
        "scans_cap",
        "scans_remaining",
    )}}


@router.post("/signup", response_model=AuthSessionResponse)
def signup(payload: AuthCredentials) -> AuthSessionResponse:
    try:
        result = auth_service.signup(payload.email, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AuthSessionResponse(**_with_plan(result))


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: AuthCredentials) -> AuthSessionResponse:
    try:
        result = auth_service.login(payload.email, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return AuthSessionResponse(**_with_plan(result))


@router.post("/logout")
def logout(
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    auth_service.logout(_bearer_token(authorization))
    return {"ok": True}


@router.get("/me", response_model=AuthUserResponse)
def me(user: CurrentUser = Depends(get_current_user)) -> AuthUserResponse:
    payload = {
        "id": user.id,
        "email": user.email or "",
        "source": user.source,
        "message": None if user.email else "Using local anonymous study session.",
    }
    return AuthUserResponse(**_with_plan(payload))
