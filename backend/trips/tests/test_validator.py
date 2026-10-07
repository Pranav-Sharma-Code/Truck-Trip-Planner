from datetime import timedelta

from trips.hos.models import EventType
from trips.hos.validator import validate

from .helpers import drive, make_events, off_duty, on_duty, sleeper


def codes(rows, cycle_used=0):
    return {v.code for v in validate(make_events(rows), cycle_used)}


def test_legal_day_has_no_violations():
    rows = [on_duty(60), drive(480), off_duty(30), drive(180), sleeper(600), drive(60)]
    assert codes(rows) == set()


def test_empty_list_is_valid():
    assert validate([]) == []


def test_nine_hours_straight_needs_a_break():
    assert codes([drive(540)]) == {"break_8h"}


def test_twelve_hours_of_driving_breaks_the_11_hour_limit():
    rows = [drive(480), off_duty(30), drive(240)]
    assert "driving_limit_11h" in codes(rows)


def test_exactly_11_hours_is_allowed():
    assert codes([drive(480), off_duty(30), drive(180)]) == set()


def test_driving_after_the_14th_hour():
    rows = [on_duty(540), drive(60), off_duty(30), drive(300)]
    assert "window_14h" in codes(rows)


def test_on_duty_work_after_hour_14_is_allowed():
    assert codes([drive(420), off_duty(30), drive(240), on_duty(300)]) == set()


def test_ten_hours_off_reopens_the_window():
    rows = [drive(480), off_duty(30), drive(180), sleeper(600), drive(480)]
    assert codes(rows) == set()


def test_nine_hours_off_does_not_reset_the_shift():
    rows = [drive(480), off_duty(30), drive(180), sleeper(540), drive(60)]
    assert "driving_limit_11h" in codes(rows)


def test_split_break_of_on_duty_and_off_duty_counts():
    rows = [drive(480), on_duty(15), off_duty(15), drive(60)]
    assert codes(rows) == set()


def test_cycle_limit_counts_prior_hours():
    rows = [drive(120)]
    assert codes(rows, cycle_used=69 * 60) == {"cycle_70h"}
    assert codes(rows, cycle_used=68 * 60) == set()


def test_restart_clears_cycle():
    rows = [drive(60), off_duty(34 * 60), drive(120)]
    assert codes(rows, cycle_used=69 * 60) == set()


def test_fuel_interval_is_checked():
    rows = [drive(60, miles=1001)]
    assert codes(rows) == {"fuel_1000mi"}


def test_fuel_stop_resets_interval():
    fuel = (EventType.FUEL, on_duty(30)[1], 30, 0.0)
    rows = [drive(60, miles=900), fuel, drive(60, miles=900)]
    assert codes(rows) == set()


def test_overlap_and_gap_are_reported():
    events = make_events([drive(60), off_duty(30), drive(60)])
    events[1].start = events[0].end - timedelta(minutes=30)  # starts before the drive ends
    assert "overlap" in {v.code for v in validate(events)}

    events = make_events([drive(60), off_duty(30), drive(60)])
    events[2].start = events[1].end + timedelta(hours=1)
    assert "gap" in {v.code for v in validate(events)}
