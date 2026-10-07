from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class DutyStatus(str, Enum):
    OFF_DUTY = "OFF_DUTY"
    SLEEPER_BERTH = "SLEEPER_BERTH"
    DRIVING = "DRIVING"
    ON_DUTY_NOT_DRIVING = "ON_DUTY_NOT_DRIVING"


OFF_STATUSES = (DutyStatus.OFF_DUTY, DutyStatus.SLEEPER_BERTH)


class EventType(str, Enum):
    DRIVE = "DRIVE"
    PICKUP = "PICKUP"
    DROPOFF = "DROPOFF"
    FUEL = "FUEL"
    BREAK = "BREAK"
    REST = "REST"
    RESTART = "RESTART"


@dataclass(frozen=True)
class Leg:
    label: str
    distance_miles: float
    duration_minutes: int


@dataclass
class Event:
    id: int
    type: EventType
    duty_status: DutyStatus
    start: datetime
    end: datetime
    start_mile: float
    end_mile: float
    reason: str
    rule: str = ""
    clocks_after: dict = field(default_factory=dict)

    @property
    def duration_minutes(self):
        return int((self.end - self.start).total_seconds() // 60)


@dataclass
class TripSchedule:
    events: list
    warnings: list
    cycle_used_start_minutes: int
    cycle_used_end_minutes: int
    total_miles: float


@dataclass(frozen=True)
class Violation:
    code: str
    message: str
    event_id: int
