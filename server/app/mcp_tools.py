"""MCP tools: thin wrappers over app/services/*.

Sync ``def`` tools run on a worker thread in mcp v2, so the sync SQLAlchemy
services are called directly (no FastAPI dependency layer involved). Every
tool runs as the member the verifier resolved for the request.
"""

from typing import Annotated

import httpx
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations
from pydantic import Field

from .config import get_settings
from .mcp_server import current_user, get_session, mcp
from .models import Plant, User
from .models.enums import CATEGORY_VALUES, SPECIES_VALUES, as_category
from .schemas.plants import ForWhomIn
from .services import music_services, plants_services
from .services.youtube import YouTubeClient, YouTubeError, YouTubeQuotaError, parse_video_id
from .utils import from_ms

settings = get_settings()

READ_ONLY = ToolAnnotations(read_only_hint=True, open_world_hint=False)
READ_EXTERNAL = ToolAnnotations(read_only_hint=True, open_world_hint=True)
MUTATING = ToolAnnotations(read_only_hint=False, open_world_hint=False)
DESTRUCTIVE = ToolAnnotations(read_only_hint=False, destructive_hint=True, open_world_hint=False)

PlantId = Annotated[str, Field(description="The plant's id.")]
Body = Annotated[str, Field(min_length=1, description="What to write.")]


def _owned(db, plant_id: str, user: User, *, allow_released: bool = False) -> Plant:
    plant = plants_services.get_plant(db, plant_id, user.id)
    if plant is None:
        raise ToolError("Plant not found.")
    if not allow_released and plant.status.value == "released":
        raise ToolError("Plant not found.")
    return plant


def _plant_result(plant: Plant, spawned: Plant | None = None) -> dict:
    result = {"plant": plants_services.plant_public(plant).model_dump(mode="json")}
    if spawned is not None:
        result["spawned"] = plants_services.plant_public(spawned).model_dump(mode="json")
    return result


def _youtube() -> YouTubeClient:
    return YouTubeClient(
        api_key=settings.youtube_api_key,
        search_daily_cap=settings.music_search_daily_cap,
        http=httpx.Client(timeout=10.0),
    )


@mcp.tool(annotations=READ_ONLY)
def list_plants() -> list[dict]:
    """List every growing plant in the garden, with events, posts and stage."""
    with get_session() as db:
        user = current_user(db)
        return [
            plants_services.plant_public(plant).model_dump(mode="json")
            for plant in plants_services.list_plants(db, user.id)
        ]


@mcp.tool(annotations=READ_ONLY)
def get_plant(plant_id: PlantId) -> dict:
    """Read one plant by id."""
    with get_session() as db:
        user = current_user(db)
        return plants_services.plant_public(_owned(db, plant_id, user)).model_dump(mode="json")


@mcp.tool(annotations=MUTATING)
def create_plant(
    body: Body,
    title: Annotated[str | None, Field(description="Title, for letters.")] = None,
    category: Annotated[
        str | None,
        Field(description="Theme for a feeling: gratitude, memory, hope, anger or feeling."),
    ] = None,
    species: Annotated[
        str | None,
        Field(description="Plant type for a letter, e.g. peony, cherry, foxglove."),
    ] = None,
    release: Annotated[bool, Field(description="Release it to the wild immediately.")] = False,
    for_whom_name: Annotated[
        str | None, Field(description="Recipient name; turns the plant into a letter.")
    ] = None,
    for_whom_email: Annotated[str | None, Field(description="Recipient email, optional.")] = None,
    give_on: Annotated[
        str | None,
        Field(description="Give-on date for a letter, YYYY-MM-DD (e.g. 2027-07-11)."),
    ] = None,
) -> dict:
    """Plant a feeling, or write a letter for someone (set for_whom_name)."""
    text = body.strip()
    if not text:
        raise ToolError("Write something first.")

    recipient = (for_whom_name or "").strip()
    chosen_species = species
    if recipient:
        chosen_species = species or "foxglove"
        if chosen_species not in SPECIES_VALUES:
            raise ToolError("Choose a valid plant type for the letter.")
        try:
            from_ms(give_on)
        except ValueError as exc:
            raise ToolError("Give-on date must look like YYYY-MM-DD.") from exc
    elif category not in CATEGORY_VALUES:
        raise ToolError("Choose a theme: gratitude, memory, hope, anger or feeling.")

    for_whom = (
        ForWhomIn(name=recipient, email=(for_whom_email or "").strip() or None, giveOn=give_on)
        if recipient
        else None
    )
    with get_session() as db:
        user = current_user(db)
        plant = plants_services.create_plant(
            db,
            owner=user,
            title=title,
            body=text,
            category=category,
            species=chosen_species,
            release=release,
            for_whom=for_whom,
        )
        return _plant_result(plant)


@mcp.tool(annotations=MUTATING)
def tend_plant(
    plant_id: PlantId,
    note: Annotated[str | None, Field(description="A short note about the tending.")] = None,
) -> dict:
    """Tend a letter so it grows. Feeling plants grow through write_post instead."""
    with get_session() as db:
        user = current_user(db)
        plant = _owned(db, plant_id, user)
        if not plant.is_letter:
            raise ToolError("This is a feeling plant - write a post instead.")
        return plants_services.plant_public(
            plants_services.tend_plant(db, plant, note)
        ).model_dump(mode="json")


@mcp.tool(annotations=MUTATING)
def write_post(plant_id: PlantId, body: Body) -> dict:
    """Write a new feeling into an existing feeling plant.

    A plant that already fruited is full: the post starts a seedling next to it,
    returned as "spawned".
    """
    text = body.strip()
    if not text:
        raise ToolError("Write something first.")
    with get_session() as db:
        user = current_user(db)
        plant = _owned(db, plant_id, user)
        if plant.is_letter:
            raise ToolError("This is a letter - tend it instead.")
        plant, spawned = plants_services.add_post(db, plant, text)
        return _plant_result(plant, spawned)


@mcp.tool(annotations=MUTATING)
def write_feeling(
    category: Annotated[
        str,
        Field(description="One of: gratitude, memory, hope, anger, feeling."),
    ],
    body: Body,
) -> dict:
    """Write into the newest plant of a feeling, planting the first one if none."""
    text = body.strip()
    if not text:
        raise ToolError("Write something first.")
    chosen = as_category(category)
    if chosen is None:
        raise ToolError("Choose a theme: gratitude, memory, hope, anger or feeling.")
    with get_session() as db:
        user = current_user(db)
        plant, spawned = plants_services.water_feeling(db, owner=user, category=chosen, body=text)
        return _plant_result(plant, spawned)


@mcp.tool(annotations=DESTRUCTIVE)
def give_plant(
    plant_id: PlantId,
    to: Annotated[str, Field(description="Who receives the gift.")] = "Someone",
    note: Annotated[str, Field(description="Note attached to the gift.")] = "",
) -> dict:
    """Give a plant away and mint its public gift link. This cannot be undone."""
    with get_session() as db:
        user = current_user(db)
        plant = _owned(db, plant_id, user)
        return plants_services.plant_public(
            plants_services.give_plant(db, plant, to, note)
        ).model_dump(mode="json")


@mcp.tool(annotations=DESTRUCTIVE)
def release_plant(plant_id: PlantId) -> dict:
    """Release a plant from the garden. This cannot be undone."""
    with get_session() as db:
        user = current_user(db)
        plant = _owned(db, plant_id, user, allow_released=True)
        plants_services.release_plant(db, plant)
        return {"ok": True}


@mcp.tool(annotations=READ_EXTERNAL)
def search_music(
    query: Annotated[str, Field(min_length=1, max_length=200, description="Song or artist.")],
    limit: Annotated[int, Field(ge=1, le=25, description="Maximum results.")] = 10,
) -> dict:
    """Search YouTube for a song (cached server-side to protect the quota)."""
    youtube = _youtube()
    if not youtube.configured:
        raise ToolError("Music search is not set up yet.")
    try:
        with get_session() as db:
            current_user(db)
            result = music_services.search_tracks(
                db,
                youtube,
                query,
                ttl_days=settings.music_search_ttl_days,
                limit=limit,
            )
            return result.model_dump(mode="json")
    except YouTubeQuotaError as exc:
        raise ToolError("Search is resting for today - paste a video link instead.") from exc
    except YouTubeError as exc:
        raise ToolError("Could not reach YouTube right now.") from exc


@mcp.tool(annotations=READ_ONLY)
def list_recents() -> list[dict]:
    """List the songs recently played from this garden."""
    with get_session() as db:
        user = current_user(db)
        return [
            music_services.track_out(track).model_dump(mode="json")
            for track in music_services.recents_for(db, user.id)
        ]


@mcp.tool(annotations=READ_ONLY)
def list_popular() -> list[dict]:
    """List the songs played most often across the garden."""
    with get_session() as db:
        return [
            music_services.track_out(track).model_dump(mode="json")
            for track in music_services.popular_tracks(db)
        ]


@mcp.tool(annotations=MUTATING)
def add_play(
    video_id: Annotated[str, Field(description="A YouTube video id or link.")],
    title: Annotated[str, Field(description="Track title.")] = "",
    author: Annotated[str, Field(description="Channel or artist.")] = "",
    thumb: Annotated[str, Field(description="Thumbnail URL.")] = "",
) -> list[dict]:
    """Remember a song as played and return the updated recents."""
    parsed = parse_video_id(video_id)
    if parsed is None:
        raise ToolError("That doesn't look like a YouTube video.")
    with get_session() as db:
        user = current_user(db)
        tracks = music_services.record_play(
            db,
            user=user,
            video_id=parsed,
            title=title.strip(),
            author=author.strip(),
            thumb=thumb.strip(),
        )
        return [music_services.track_out(track).model_dump(mode="json") for track in tracks]
