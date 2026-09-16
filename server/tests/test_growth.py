from datetime import UTC, datetime, timedelta

from app.models.enums import Stage
from app.services.growth import DAY, derive_stage

NOW = datetime(2026, 9, 16, tzinfo=UTC)


def plant(age_days: float, event_days_ago: list[float]) -> dict:
    return {
        "created_at": NOW - timedelta(days=age_days),
        "event_times": [NOW - timedelta(days=d) for d in event_days_ago],
    }


def stage(age_days: float, event_days_ago: list[float]) -> Stage:
    return derive_stage(**plant(age_days, event_days_ago), now=NOW)


def test_day_is_milliseconds() -> None:
    assert DAY == 86_400_000


def test_fresh_planting_is_a_seed() -> None:
    assert stage(1, [1]) is Stage.seed


def test_second_tending_sprouts_third_flowers() -> None:
    assert stage(3, [3, 1]) is Stage.sprout
    assert stage(4, [4, 3, 2]) is Stage.flower


def test_fruit_needs_tendings_and_age() -> None:
    assert stage(1, [1, 0.9, 0.8, 0.7, 0.6]) is Stage.flower
    assert stage(3, [3, 2, 1, 0.9, 0.8]) is Stage.fruit


def test_neglect_withers_and_tending_revives() -> None:
    assert stage(40, [40]) is Stage.withered
    revived = plant(20, [20, 19, 18, 17, 16])
    assert derive_stage(**revived, now=NOW) is Stage.withered
    revived["event_times"].append(NOW)
    assert derive_stage(**revived, now=NOW) is Stage.fruit


def test_plant_without_events_uses_creation_time() -> None:
    assert stage(1, []) is Stage.seed
    assert stage(30, []) is Stage.withered
