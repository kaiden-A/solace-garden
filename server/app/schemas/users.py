from pydantic import BaseModel, Field

from ..models.enums import UserKind


class PublicUser(BaseModel):
    """Shape the client already expects (client/lib/types.ts)."""

    id: str
    name: str
    email: str
    kind: UserKind


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str | None = None
    kind: UserKind = UserKind.member
    zitadel_sub: str | None = None
    idp_issuer: str | None = None


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    kind: UserKind
    createdAt: int
    guestExpiresAt: int | None = None
