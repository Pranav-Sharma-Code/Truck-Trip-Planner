from datetime import timedelta

from . import constants as c
from .clock import HosClock
from .models import DutyStatus, Event, EventType, TripSchedule

MAX_ITERATIONS = 5000


def plan_trip(to_pickup, to_dropoff, start, cycle_used_minutes):
    if start.tzinfo is None:
        raise ValueError("start must be timezone-aware")
    if not 0 <= cycle_used_minutes <= c.CYCLE_LIMIT:
        raise ValueError("cycle_used_minutes must be between 0 and the 70-hour limit")

    planner = _Planner(start, cycle_used_minutes)
    planner.drive(to_pickup)
    planner.work(EventType.PICKUP, c.PICKUP_DURATION, "Pickup (1 hour on duty, not driving)")
    planner.drive(to_dropoff)
    planner.work(EventType.DROPOFF, c.DROPOFF_DURATION, "Drop-off (1 hour on duty, not driving)")
    return planner.result(cycle_used_minutes)


class _Planner:
    def __init__(self, start, cycle_used_minutes):
        self.start = start
        self.clock = HosClock(cycle_used_minutes)
        self.events = []
        self.warnings = []
        self.miles = 0.0

    def result(self, cycle_used_start):
        return TripSchedule(
            events=self.events,
            warnings=self.warnings,
            cycle_used_start_minutes=cycle_used_start,
            cycle_used_end_minutes=self.clock.cycle_used,
            total_miles=self.miles,
        )

    def _emit(self, type_, status, minutes, reason, rule="", miles=0.0, refuel=False):
        begin = self.clock.now
        start_mile = self.miles
        self.clock.apply(status, minutes, miles=miles, refuel=refuel)
        self.miles += miles
        self.events.append(
            Event(
                id=len(self.events) + 1,
                type=type_,
                duty_status=status,
                start=self.start + timedelta(minutes=begin),
                end=self.start + timedelta(minutes=begin + minutes),
                start_mile=start_mile,
                end_mile=self.miles,
                reason=reason,
                rule=rule,
                clocks_after=self.clock.snapshot(),
            )
        )

    def work(self, type_, minutes, reason):
        self._emit(type_, DutyStatus.ON_DUTY_NOT_DRIVING, minutes, reason, rule=c.RULE_ASSESSMENT)

    def drive(self, leg):
        if leg.duration_minutes == 0:
            if leg.distance_miles > 0:
                raise ValueError("a leg with distance needs a positive duration")
            return

        miles_per_minute = leg.distance_miles / leg.duration_minutes
        remaining_minutes = leg.duration_minutes
        remaining_miles = leg.distance_miles
        clock = self.clock

        # Priority: restart > rest > fuel > break. A bigger reset also satisfies the smaller ones.
        for _ in range(MAX_ITERATIONS):
            if remaining_minutes == 0:
                return

            if clock.cycle_left() <= 0:
                self._restart()
            elif clock.driving_left() <= 0 or clock.window_left() <= 0:
                self._rest()
            elif clock.miles_since_fuel > 0 and clock.fuel_left_miles() < miles_per_minute:
                self._fuel()
            elif clock.until_break() <= 0:
                self._break()
            else:
                fuel_minutes = max(1, int(clock.fuel_left_miles() // miles_per_minute))
                chunk = min(
                    remaining_minutes,
                    clock.driving_left(),
                    clock.window_left(),
                    clock.until_break(),
                    clock.cycle_left(),
                    fuel_minutes,
                )
                # Use the exact remaining miles on the last chunk so legs don't drift.
                miles = remaining_miles if chunk == remaining_minutes else chunk * miles_per_minute
                self._emit(
                    EventType.DRIVE,
                    DutyStatus.DRIVING,
                    chunk,
                    f"Driving to {leg.label}",
                    miles=miles,
                )
                remaining_minutes -= chunk
                remaining_miles -= miles
        raise RuntimeError("scheduler did not converge")

    def _break(self):
        self._emit(
            EventType.BREAK,
            DutyStatus.OFF_DUTY,
            c.BREAK_DURATION,
            "30-minute break required after 8 hours of driving",
            rule=c.RULE_BREAK,
        )

    def _fuel(self):
        self._emit(
            EventType.FUEL,
            DutyStatus.ON_DUTY_NOT_DRIVING,
            c.FUEL_STOP_DURATION,
            "Fuel stop: at least one fuel stop every 1,000 miles",
            rule=c.RULE_ASSESSMENT,
            refuel=True,
        )

    def _rest(self):
        if self.clock.driving_left() <= 0:
            reason = "11-hour driving limit reached: 10 consecutive hours off duty required"
            rule = c.RULE_DRIVING_LIMIT
        else:
            reason = "14-hour duty window ended: 10 consecutive hours off duty required"
            rule = c.RULE_DUTY_WINDOW
        self._emit(EventType.REST, DutyStatus.SLEEPER_BERTH, c.SHIFT_RESET_OFF_DUTY, reason, rule=rule)

    def _restart(self):
        if not self.events:
            code = "cycle_exhausted_at_start"
            message = "No cycle hours remain at departure, so a 34-hour restart is scheduled before driving."
        else:
            code = "restart_scheduled"
            message = "The 70-hour cycle ran out mid-trip, so a 34-hour restart is scheduled."
        self.warnings.append({"code": code, "message": message})
        self._emit(
            EventType.RESTART,
            DutyStatus.OFF_DUTY,
            c.RESTART_OFF_DUTY,
            "70-hour/8-day cycle exhausted: 34 consecutive hours off duty restarts the cycle",
            rule=c.RULE_RESTART,
        )
