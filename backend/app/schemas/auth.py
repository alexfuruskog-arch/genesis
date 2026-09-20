from pydantic import BaseModel, Field


class AuthCredentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=6, max_length=128)


class MembershipSnapshot(BaseModel):
    plan: str = "free"
    plan_label: str = "Free"
    unlimited: bool = False
    billing_status: str = "none"
    plan_expires_at: str | None = None
    chats_used: int = 0
    chats_cap: int = 3
    chats_remaining: int = 3
    scans_used: int = 0
    scans_cap: int = 5
    scans_remaining: int = 5
    email: str | None = None


class AuthUserResponse(BaseModel):
    id: str
    email: str
    source: str
    message: str | None = None
    plan: str = "free"
    plan_label: str = "Free"
    unlimited: bool = False
    billing_status: str = "none"
    plan_expires_at: str | None = None
    chats_used: int = 0
    chats_cap: int = 3
    chats_remaining: int = 3
    scans_used: int = 0
    scans_cap: int = 5
    scans_remaining: int = 5


class AuthSessionResponse(AuthUserResponse):
    token: str
