from pydantic import BaseModel, Field

from ..models.enums import Category, PlantStatus, Species, Stage


class ForWhomIn(BaseModel):
    name: str | None = None
    email: str | None = None
    giveOn: int | str | None = None


class ForWhomOut(BaseModel):
    name: str
    email: str | None = None
    giveOn: int | None = None


class PlantCreate(BaseModel):
    title: str | None = None
    body: str
    category: str | None = None
    species: str | None = None
    release: bool = False
    forWhom: ForWhomIn | None = None


class TendRequest(BaseModel):
    note: str | None = None


class PostCreate(BaseModel):
    body: str


class PostOut(BaseModel):
    body: str
    at: int


class GiveRequest(BaseModel):
    to: str | None = None
    note: str | None = None


class PlantEventOut(BaseModel):
    type: str
    note: str | None = None
    at: int


class GiftOut(BaseModel):
    to: str
    note: str
    token: str
    givenAt: int


class PlantPublic(BaseModel):
    id: str
    ownerId: str
    title: str
    body: str
    category: Category | None = None
    species: Species | None = None
    status: PlantStatus
    x: float
    y: float
    scale: float
    seed: int
    createdAt: int
    events: list[PlantEventOut] = Field(default_factory=list)
    posts: list[PostOut] = Field(default_factory=list)
    gift: GiftOut | None = None
    forWhom: ForWhomOut | None = None
    stage: Stage


class PostResultOut(BaseModel):
    """A new post can outgrow its plant: `spawned` is the seedling it began."""

    plant: PlantPublic
    spawned: PlantPublic | None = None
