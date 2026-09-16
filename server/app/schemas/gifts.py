from pydantic import BaseModel, Field

from ..models.enums import Species
from .plants import ForWhomOut


class LetterOut(BaseModel):
    note: str
    at: int


class GiftPayload(BaseModel):
    """Public shape of a wrapped gift (client/lib/types.ts GiftPayload)."""

    title: str
    body: str
    species: Species
    to: str
    note: str
    givenAt: int
    forWhom: ForWhomOut | None = None
    letters: list[LetterOut] = Field(default_factory=list)
