import random

import pytest

from trips.hos import constants as c
from trips.hos.models import DutyStatus, EventType
from trips.hos.scheduler import plan_trip
from trips.hos.validator import validate

from .helpers import START, hhmm, leg


def plan(to_pickup, to_dropoff, cycle_hours=0):
    return plan_trip(to_pickup, to_dropoff, START, round(cycle_hours * 60))


def types(schedule):
    return [e.type for e in schedule.events]


def test_worked_example_from_the_plan():
    schedule = plan(leg("pickup", 180, 3), leg("drop-off", 900, 14), cycle_hours=20)
    got = [(e.type, hhmm(e), e.duration_minutes) for e in schedule.events]
    assert got == [
        (EventType.DRIVE, (0, "06:00"), 180),
        (EventType.PICKUP, (0, "09:00"), 60),
        (EventType.DRIVE, (0, "10:00"), 480),
        (EventType.REST, (0, "18:00"), 600),
        (EventType.DRIVE, (1, "04:00"), 285),
        (EventType.FUEL, (1, "08:45"), 30),
        (EventType.DRIVE, (1, "09:15"), 75),
        (EventType.DROPOFF, (1, "10:30"), 60),
    ]
    assert schedule.cycle_used_start_minutes == 20 * 60
    assert schedule.cycle_used_end_minutes == int(39.5 * 60)
    assert schedule.total_miles == pytest.approx(1080)
    assert validate(schedule.events, 20 * 60) == []


def test_break_inserted_at_exactly_8_hours_of_driving():
    schedule = plan(leg("pickup", 540, 9), leg("drop-off", 0, 0))
    got = [(e.type, e.duration_minutes) for e in schedule.events]
    assert got == [
        (EventType.DRIVE, 480),
        (EventType.BREAK, 30),
        (EventType.DRIVE, 60),
        (EventType.PICKUP, 60),
        (EventType.DROPOFF, 60),
    ]


def test_no_break_when_leg_is_exactly_8_hours():
    schedule = plan(leg("pickup", 480, 8), leg("drop-off", 0, 0))
    assert EventType.BREAK not in types(schedule)


def test_rest_after_exactly_11_hours_of_driving():
    schedule = plan(leg("pickup", 720, 12), leg("drop-off", 0, 0))
    got = [(e.type, e.duration_minutes) for e in schedule.events[:5]]
    assert got == [
        (EventType.DRIVE, 480),
        (EventType.BREAK, 30),
        (EventType.DRIVE, 180),
        (EventType.REST, 600),
        (EventType.DRIVE, 60),
    ]
    rest = schedule.events[3]
    assert rest.duty_status is DutyStatus.SLEEPER_BERTH
    assert rest.rule == c.RULE_DRIVING_LIMIT


def test_pickup_and_dropoff_are_one_hour_on_duty_and_count_toward_cycle():
    schedule = plan(leg("pickup", 60, 1), leg("drop-off", 60, 1), cycle_hours=10)
    pickup, dropoff = (e for e in schedule.events if e.type in (EventType.PICKUP, EventType.DROPOFF))
    assert pickup.duration_minutes == dropoff.duration_minutes == 60
    assert pickup.duty_status is dropoff.duty_status is DutyStatus.ON_DUTY_NOT_DRIVING
    assert schedule.cycle_used_end_minutes == (10 + 1 + 1 + 1 + 1) * 60


def test_zero_length_first_leg_starts_with_pickup():
    schedule = plan(leg("pickup", 0, 0), leg("drop-off", 120, 2))
    assert schedule.events[0].type is EventType.PICKUP


def test_pickup_resets_the_break_clock():
    schedule = plan(leg("pickup", 420, 7), leg("drop-off", 420, 7))
    assert EventType.BREAK not in types(schedule)


@pytest.mark.parametrize("miles, fuel_stops", [(999, 0), (1000, 0), (1001, 1), (2500, 2)])
def test_fuel_stops_around_1000_mile_threshold(miles, fuel_stops):
    schedule = plan(leg("pickup", 0, 0), leg("drop-off", miles, miles / 60))
    assert types(schedule).count(EventType.FUEL) == fuel_stops
    assert validate(schedule.events) == []


def test_first_fuel_stop_is_at_or_before_1000_miles():
    schedule = plan(leg("pickup", 0, 0), leg("drop-off", 1500, 25))
    fuel = next(e for e in schedule.events if e.type is EventType.FUEL)
    assert 999 < fuel.start_mile <= 1000


def test_cycle_near_limit_forces_restart_mid_leg():
    schedule = plan(leg("pickup", 120, 2), leg("drop-off", 0, 0), cycle_hours=69.5)
    got = [(e.type, e.duration_minutes) for e in schedule.events[:3]]
    assert got == [(EventType.DRIVE, 30), (EventType.RESTART, 34 * 60), (EventType.DRIVE, 90)]
    assert [w["code"] for w in schedule.warnings] == ["restart_scheduled"]
    assert validate(schedule.events, round(69.5 * 60)) == []


def test_full_cycle_restarts_before_departure():
    schedule = plan(leg("pickup", 60, 1), leg("drop-off", 60, 1), cycle_hours=70)
    assert schedule.events[0].type is EventType.RESTART
    assert [w["code"] for w in schedule.warnings] == ["cycle_exhausted_at_start"]


def test_moderate_cycle_needs_no_restart():
    schedule = plan(leg("pickup", 120, 2), leg("drop-off", 300, 5), cycle_hours=25)
    assert EventType.RESTART not in types(schedule)
    assert schedule.warnings == []


def test_multi_day_trip_is_contiguous_and_legal():
    schedule = plan(leg("pickup", 500, 8), leg("drop-off", 2400, 40), cycle_hours=10)
    events = schedule.events
    assert types(schedule).count(EventType.REST) >= 3
    for before, after in zip(events, events[1:]):
        assert before.end == after.start
    assert events[0].start == START
    assert validate(events, 10 * 60) == []


def test_invalid_inputs_rejected():
    with pytest.raises(ValueError):
        plan_trip(leg("p", 1, 1), leg("d", 1, 1), START.replace(tzinfo=None), 0)
    with pytest.raises(ValueError):
        plan_trip(leg("p", 1, 1), leg("d", 1, 1), START, -1)
    with pytest.raises(ValueError):
        plan_trip(leg("p", 1, 1), leg("d", 1, 1), START, c.CYCLE_LIMIT + 1)


def test_events_carry_reasons_and_clock_snapshots():
    schedule = plan(leg("pickup", 540, 9), leg("drop-off", 0, 0))
    brk = next(e for e in schedule.events if e.type is EventType.BREAK)
    assert brk.rule == c.RULE_BREAK
    assert "8 hours" in brk.reason
    assert brk.clocks_after["driving_minutes_since_break"] == 0
    assert all(e.reason for e in schedule.events)


def test_random_trips_always_validate():
    rng = random.Random(7)
    for _ in range(300):
        miles_a = rng.choice([0, rng.uniform(1, 400)])
        miles_b = rng.uniform(1, 3500)
        mph = rng.uniform(35, 70)
        cycle = rng.choice([0, rng.uniform(0, 70), 69.9, 70])
        a = leg("pickup", miles_a, round(miles_a / mph * 60) / 60)
        b = leg("drop-off", miles_b, round(miles_b / mph * 60) / 60)
        schedule = plan(a, b, cycle_hours=cycle)
        assert validate(schedule.events, round(cycle * 60)) == [], (miles_a, miles_b, mph, cycle)
