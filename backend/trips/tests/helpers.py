from datetime import datetime, timedelta, timezone

from trips.hos.models import DutyStatus, Event, EventType, Leg

START = datetime(2026, 10, 8, 6, 0, tzinfo=timezone.utc)


def leg(label, miles, hours):
    return Leg(label, miles, round(hours * 60))


def hhmm(event, origin=START):
    """(day offset, 'HH:MM') of an event start relative to the trip start date."""
    days = (event.start.date() - origin.date()).days
    return days, event.start.strftime("%H:%M")


def make_events(rows, cycle_start=START):
    """Build contiguous events from (type, status, minutes, miles) rows."""
    events = []
    cursor = cycle_start
    miles = 0.0
    for i, (type_, status, minutes, driven) in enumerate(rows, start=1):
        end = cursor + timedelta(minutes=minutes)
        events.append(
            Event(
                id=i,
                type=type_,
                duty_status=status,
                start=cursor,
                end=end,
                start_mile=miles,
                end_mile=miles + driven,
                reason="",
            )
        )
        cursor = end
        miles += driven
    return events


def drive(minutes, miles=None):
    return (EventType.DRIVE, DutyStatus.DRIVING, minutes, minutes / 2 if miles is None else miles)


def on_duty(minutes):
    return (EventType.PICKUP, DutyStatus.ON_DUTY_NOT_DRIVING, minutes, 0.0)


def off_duty(minutes):
    return (EventType.BREAK, DutyStatus.OFF_DUTY, minutes, 0.0)


def sleeper(minutes):
    return (EventType.REST, DutyStatus.SLEEPER_BERTH, minutes, 0.0)
