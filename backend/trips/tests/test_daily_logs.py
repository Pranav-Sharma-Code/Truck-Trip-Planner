import random
from datetime import datetime, timezone

import pytest

from trips.hos.daily_logs import MINUTES_PER_DAY, build_daily_logs
from trips.hos.models import EventType
from trips.hos.scheduler import plan_trip

from .helpers import START, drive, leg, make_events, off_duty


def worked_example_logs(labels=None):
    schedule = plan_trip(leg("pickup", 180, 3), leg("drop-off", 900, 14), START, 20 * 60)
    return schedule, build_daily_logs(schedule.events, schedule.cycle_used_start_minutes, labels)


def test_no_events_gives_no_logs():
    assert build_daily_logs([]) == []


def test_worked_example_makes_two_sheets_with_expected_totals():
    _, logs = worked_example_logs()
    assert [log["date"] for log in logs] == ["2026-10-08", "2026-10-09"]
    assert logs[0]["totals_hours"] == {
        "OFF_DUTY": 6.0,
        "SLEEPER_BERTH": 6.0,
        "DRIVING": 11.0,
        "ON_DUTY_NOT_DRIVING": 1.0,
    }
    assert logs[1]["totals_hours"] == {
        "OFF_DUTY": 12.5,
        "SLEEPER_BERTH": 4.0,
        "DRIVING": 6.0,
        "ON_DUTY_NOT_DRIVING": 1.5,
    }


def test_worked_example_miles_and_cycle_recap():
    schedule, logs = worked_example_logs()
    assert logs[0]["total_miles"] == pytest.approx(694.3, abs=0.1)
    assert logs[1]["total_miles"] == pytest.approx(385.7, abs=0.1)
    assert sum(log["total_miles"] for log in logs) == pytest.approx(schedule.total_miles, abs=0.2)

    assert logs[0]["recap"]["cycle_used_minutes"] == 32 * 60
    assert logs[0]["recap"]["cycle_available_minutes"] == 38 * 60
    assert logs[1]["recap"]["cycle_used_minutes"] == int(39.5 * 60)
    assert logs[0]["recap"]["on_duty_minutes_today"] == 12 * 60


def test_segments_are_ordered_merged_and_cover_the_day():
    _, logs = worked_example_logs()
    for log in logs:
        segments = log["segments"]
        assert segments[0]["start_minute"] == 0
        assert segments[-1]["end_minute"] == MINUTES_PER_DAY
        for before, after in zip(segments, segments[1:]):
            assert before["end_minute"] == after["start_minute"]
            assert before["status"] != after["status"]


def test_exact_midnight_split_halves_the_miles():
    start = datetime(2026, 10, 8, 22, 0, tzinfo=timezone.utc)
    events = make_events([drive(240, miles=240)], cycle_start=start)
    logs = build_daily_logs(events)
    assert [log["total_miles"] for log in logs] == [120.0, 120.0]
    assert logs[0]["totals_minutes"]["DRIVING"] == 120
    assert logs[1]["totals_minutes"]["DRIVING"] == 120


def test_trip_ending_exactly_at_midnight_has_no_extra_sheet():
    start = datetime(2026, 10, 8, 20, 0, tzinfo=timezone.utc)
    events = make_events([drive(240)], cycle_start=start)
    assert len(build_daily_logs(events)) == 1


def test_restart_spanning_days_resets_cycle_only_once_it_completes():
    rows = [drive(120), off_duty(34 * 60), drive(60)]
    events = make_events(rows)
    events[1].type = EventType.RESTART
    logs = build_daily_logs(events, cycle_used_start_minutes=60 * 60)
    assert len(logs) == 2
    assert logs[0]["recap"]["cycle_used_minutes"] == 62 * 60  # restart still running at midnight
    assert logs[1]["recap"]["cycle_used_minutes"] == 60  # restart done, then 1h driving


def test_restart_completed_flag_only_on_the_day_it_ends():
    events = make_events([drive(60), off_duty(34 * 60)])
    events[1].type = EventType.RESTART
    logs = build_daily_logs(events)
    assert [log["recap"]["restart_completed"] for log in logs] == [False, True]


def test_remarks_use_labels_at_each_status_change():
    schedule, _ = worked_example_logs()
    labels = {
        e.id: {"start": f"Place {e.id}, TX", "end": f"Place {e.id + 1}, TX"} for e in schedule.events
    }
    logs = build_daily_logs(schedule.events, schedule.cycle_used_start_minutes, labels)
    day1 = logs[0]["remarks"]
    assert [(r["minute"], r["note"]) for r in day1] == [
        (360, "Driving"),
        (540, "Pickup"),
        (600, "Driving"),
        (1080, "10-hour rest"),
    ]
    assert day1[0]["location"] == "Place 1, TX"
    day2 = logs[1]["remarks"]
    assert day2[-1] == {"minute": 11 * 60 + 30, "location": "Place 9, TX", "note": "Off duty"}
    assert logs[0]["from_label"] == "Place 1, TX"
    assert logs[1]["to_label"] == "Place 9, TX"


def test_missing_labels_are_none_not_errors():
    _, logs = worked_example_logs()
    assert logs[0]["remarks"][0]["location"] is None
    assert logs[0]["from_label"] is None


def test_random_trips_always_sum_to_24_hours_and_match_total_miles():
    rng = random.Random(11)
    for _ in range(100):
        miles_b = rng.uniform(50, 3500)
        mph = rng.uniform(40, 65)
        cycle = rng.choice([0, rng.uniform(0, 70), 69.9])
        schedule = plan_trip(
            leg("pickup", 100, 100 / mph),
            leg("drop-off", miles_b, miles_b / mph),
            START,
            round(cycle * 60),
        )
        logs = build_daily_logs(schedule.events, schedule.cycle_used_start_minutes)
        for log in logs:
            assert sum(log["totals_minutes"].values()) == MINUTES_PER_DAY
        assert sum(log["total_miles"] for log in logs) == pytest.approx(
            schedule.total_miles, abs=0.1 * len(logs)
        )
