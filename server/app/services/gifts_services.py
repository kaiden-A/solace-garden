from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from ..models import Gift, Plant
from ..models.enums import EventType, species_of
from ..schemas.gifts import GiftPayload, LetterOut
from ..schemas.plants import ForWhomOut
from ..utils import to_ms


def gift_payload(db: DbSession, token: str) -> GiftPayload | None:
    gift = db.scalar(select(Gift).where(Gift.token == token))
    if gift is None:
        return None
    plant = db.get(Plant, gift.plant_id)
    if plant is None:
        return None

    for_whom = None
    if plant.for_whom_name:
        for_whom = ForWhomOut(
            name=plant.for_whom_name,
            email=plant.for_whom_email,
            giveOn=to_ms(plant.for_whom_give_on),
        )

    return GiftPayload(
        title=plant.title,
        body=plant.body,
        species=species_of(species=plant.species, category=plant.category),
        to=gift.to_name,
        note=gift.note,
        givenAt=to_ms(gift.given_at) or 0,
        forWhom=for_whom,
        letters=[
            LetterOut(note=event.note or "Tended it again", at=to_ms(event.at) or 0)
            for event in plant.events
            if event.type is EventType.tended
        ],
    )
