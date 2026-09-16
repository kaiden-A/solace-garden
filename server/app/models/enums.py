import enum


class UserKind(enum.StrEnum):
    member = "member"
    guest = "guest"


class Category(enum.StrEnum):
    gratitude = "gratitude"
    memory = "memory"
    hope = "hope"
    anger = "anger"
    feeling = "feeling"


class Species(enum.StrEnum):
    peony = "peony"
    forget_me_not = "forget-me-not"
    cherry = "cherry"
    rose = "rose"
    foxglove = "foxglove"
    wisteria = "wisteria"


class PlantStatus(enum.StrEnum):
    growing = "growing"
    given = "given"
    released = "released"


class EventType(enum.StrEnum):
    planted = "planted"
    tended = "tended"
    given = "given"


class Stage(enum.StrEnum):
    seed = "seed"
    sprout = "sprout"
    flower = "flower"
    fruit = "fruit"
    withered = "withered"


CATEGORY_SPECIES: dict[Category, Species] = {
    Category.gratitude: Species.peony,
    Category.memory: Species.forget_me_not,
    Category.hope: Species.cherry,
    Category.anger: Species.rose,
    Category.feeling: Species.wisteria,
}

CATEGORY_VALUES: frozenset[str] = frozenset(c.value for c in Category)
SPECIES_VALUES: frozenset[str] = frozenset(s.value for s in Species)


def as_category(value: str | None) -> Category | None:
    if value is not None and value in CATEGORY_VALUES:
        return Category(value)
    return None


def as_species(value: str | None) -> Species | None:
    if value is not None and value in SPECIES_VALUES:
        return Species(value)
    return None


def species_of(*, species: Species | None, category: Category | None) -> Species:
    if species is not None:
        return species
    if category is not None:
        return CATEGORY_SPECIES[category]
    return Species.wisteria

