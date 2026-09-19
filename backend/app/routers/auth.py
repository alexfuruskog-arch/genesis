from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException

from app.deps import CurrentUser, get_current_user
from app.schemas.auth import AuthCredentials, AuthSessionResponse, AuthUserResponse
from app.services.auth import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _bearer_token(authorization: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return None


@router.post("/signup", response_model=AuthSessionResponse)
def signup(payload: AuthCredentials) -> AuthSessionResponse:
    try:
        result = auth_service.signup(payload.email, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AuthSessionResponse(**result)


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: AuthCredentials) -> AuthSessionResponse:
    try:
        result = auth_service.login(payload.email, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return AuthSessionResponse(**result)


@router.post("/logout")
def logout(
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    auth_service.logout(_bearer_token(authorization))
    return {"ok": True}


@router.get("/me", response_model=AuthUserResponse)
def me(user: CurrentUser = Depends(get_current_user)) -> AuthUserResponse:
    return AuthUserResponse(
        id=user.id,
        email=user.email or "",
        source=user.source,
        message=None if user.email else "Using local anonymous study session.",
    )
