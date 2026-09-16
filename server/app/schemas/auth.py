from pydantic import BaseModel


class GuestRequest(BaseModel):
    name: str | None = None


class OAuthStart(BaseModel):
    """Internal carrier for the state/nonce/verifier cookie during login."""

    state: str
    nonce: str
    code_verifier: str
    next: str = "/garden"


class LogoutResponse(BaseModel):
    ok: bool = True
    logoutUrl: str | None = None
