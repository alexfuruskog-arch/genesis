from pydantic import BaseModel, Field


class AuthCredentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=6, max_length=128)


class AuthUserResponse(BaseModel):
    id: str
    email: str
    source: str
    message: str | None = None


class AuthSessionResponse(AuthUserResponse):
    token: str
