import pytest

from trips.hos.clock import HosClock
from trips.hos.models import DutyStatus

DRIVING = DutyStatus.DRIVING
ON_DUTY = DutyStatus.ON_DUTY_NOT_DRIVING
OFF = DutyStatus.OFF_DUTY
SLEEPER = DutyStatus.SLEEPER_BERTH


def test_break_due_at_exactly_8_hours_of_driving():
    clock = HosClock()
    clock.apply(DRIVING, 479)
    assert clock.until_break() == 1
    clock.apply(DRIVING, 1)
    assert clock.until_break() == 0


def test_consecutive_on_duty_and_off_duty_satisfy_break():
    clock = HosClock()
    clock.apply(DRIVING, 480)
    clock.apply(ON_DUTY, 15)
    assert clock.until_break() == 0
    clock.apply(OFF, 15)
    assert clock.until_break() == 480


def test_non_consecutive_short_stops_do_not_satisfy_break():
    clock = HosClock()
    clock.apply(DRIVING, 480)
    clock.apply(OFF, 15)
    clock.apply(DRIVING, 1)
    clock.apply(OFF, 15)
    assert clock.driving_since_break == 481
    assert clock.until_break() == -1


def test_eleven_hours_of_driving_exhausts_the_shift():
    clock = HosClock()
    clock.apply(DRIVING, 660)
    assert clock.driving_left() == 0


def test_window_runs_on_wall_time_from_first_work():
    clock = HosClock()
    clock.apply(OFF, 120)  # waiting off duty does not open the window
    clock.apply(ON_DUTY, 600)
    assert clock.window_left() == 240
    clock.apply(OFF, 300)  # off-duty time inside the window still counts
    assert clock.window_left() == -60


def test_ten_hours_off_resets_shift_counters():
    clock = HosClock()
    clock.apply(DRIVING, 300)
    clock.apply(SLEEPER, 599)
    assert clock.driving_in_shift == 300
    clock.apply(SLEEPER, 1)
    assert clock.driving_in_shift == 0
    assert clock.shift_start is None
    assert clock.window_left() == 840


def test_cycle_accumulates_driving_and_on_duty_only():
    clock = HosClock(cycle_used_minutes=25 * 60)
    clock.apply(DRIVING, 120)
    clock.apply(ON_DUTY, 60)
    clock.apply(OFF, 300)
    assert clock.cycle_used == 25 * 60 + 180
    assert clock.cycle_left() == 70 * 60 - 25 * 60 - 180


def test_34_hours_off_restarts_cycle_but_33h59_does_not():
    clock = HosClock(cycle_used_minutes=60 * 60)
    clock.apply(OFF, 34 * 60 - 1)
    assert clock.cycle_used == 60 * 60
    clock.apply(SLEEPER, 1)  # mixed off duty and sleeper berth still counts
    assert clock.cycle_used == 0


def test_refuel_resets_miles_since_fuel():
    clock = HosClock()
    clock.apply(DRIVING, 600, miles=600)
    assert clock.fuel_left_miles() == 400
    clock.apply(ON_DUTY, 30, refuel=True)
    assert clock.fuel_left_miles() == 1000


def test_non_positive_minutes_rejected():
    with pytest.raises(ValueError):
        HosClock().apply(DRIVING, 0)
