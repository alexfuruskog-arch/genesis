from fastapi import APIRouter, Depends

from app.deps import CurrentUser, get_current_user
from app.schemas.auth import MembershipSnapshot
from app.services.membership import membership_service

router = APIRouter(prefix="/membership", tags=["membership"])


@router.get("", response_model=MembershipSnapshot)
@router.get("/me", response_model=MembershipSnapshot)
def membership_me(user: CurrentUser = Depends(get_current_user)) -> MembershipSnapshot:
    return MembershipSnapshot(**membership_service.snapshot(user))
