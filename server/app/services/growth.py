"""Growth rules - a deliberate 1:1 port of client/lib/growth.ts.

The client keeps its own copy for optimistic rendering; tests/test_growth.py
pins both implementations to the same numbers.
"""

from collections.abc import Sequence
from datetime import UTC, datetime

from ..models.enums import Stage

DAY = 86_400_000

RULES = {
    "sprout": 2,
    "flower": 3,
    "fruit": 5,
    "fruitMinDays": 2,
    "witherAfterDays": 14,
}


def _ms(value: datetime) -> float:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.timestamp() * 1000


def derive_stage(
    *,
    event_times: Sequence[datetime],
    created_at: datetime,
    now: datetime | None = None,
) -> Stage:
    moment = _ms(now) if now is not None else datetime.now(UTC).timestamp() * 1000
    last = _ms(event_times[-1]) if event_times else _ms(created_at)
    idle_days = (moment - last) / DAY
    age_days = (moment - _ms(created_at)) / DAY

    if idle_days >= RULES["witherAfterDays"]:
        return Stage.withered
    if len(event_times) >= RULES["fruit"] and age_days >= RULES["fruitMinDays"]:
        return Stage.fruit
    if len(event_times) >= RULES["flower"]:
        return Stage.flower
    if len(event_times) >= RULES["sprout"]:
        return Stage.sprout
    return Stage.seed
