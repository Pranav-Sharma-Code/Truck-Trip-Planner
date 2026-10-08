from . import constants as c
from .models import DutyStatus


class HosClock:

    def __init__(self, cycle_used_minutes=0):
        self.now = 0
        self.cycle_used = cycle_used_minutes
        self.shift_start = None
        self.driving_in_shift = 0
        self.driving_since_break = 0
        self.miles_since_fuel = 0.0
        self._non_driving_streak = 0
        self._off_duty_streak = 0

    def apply(self, status, minutes, miles=0.0, refuel=False):
        if minutes <= 0:
            raise ValueError("minutes must be positive")

        if status in (DutyStatus.DRIVING, DutyStatus.ON_DUTY_NOT_DRIVING):
            if self.shift_start is None:
                self.shift_start = self.now
            self.cycle_used += minutes
            self._off_duty_streak = 0
        else:
            self._off_duty_streak += minutes

        if status is DutyStatus.DRIVING:
            self.driving_in_shift += minutes
            self.driving_since_break += minutes
            self.miles_since_fuel += miles
            self._non_driving_streak = 0
        else:
            self._non_driving_streak += minutes

        if refuel:
            self.miles_since_fuel = 0.0

        self.now += minutes
        self._apply_resets()

    def _apply_resets(self):
        if self._non_driving_streak >= c.BREAK_DURATION:
            self.driving_since_break = 0
        if self._off_duty_streak >= c.SHIFT_RESET_OFF_DUTY:
            self.shift_start = None
            self.driving_in_shift = 0
            self.driving_since_break = 0
        if self._off_duty_streak >= c.RESTART_OFF_DUTY:
            self.cycle_used = 0

    def driving_left(self):
        return c.MAX_DRIVING_PER_SHIFT - self.driving_in_shift

    def window_elapsed(self):
        return 0 if self.shift_start is None else self.now - self.shift_start

    def window_left(self):
        return c.DUTY_WINDOW - self.window_elapsed()

    def until_break(self):
        return c.DRIVING_BEFORE_BREAK - self.driving_since_break

    def cycle_left(self):
        return c.CYCLE_LIMIT - self.cycle_used

    def fuel_left_miles(self):
        return c.FUEL_INTERVAL_MILES - self.miles_since_fuel

    def snapshot(self):
        return {
            "driving_minutes_in_shift": self.driving_in_shift,
            "window_elapsed_minutes": self.window_elapsed(),
            "driving_minutes_since_break": self.driving_since_break,
            "cycle_used_minutes": self.cycle_used,
            "miles_since_fuel": round(self.miles_since_fuel, 1),
        }
