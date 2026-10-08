"""The worked example from the FMCSA Interstate Truck Driver's Guide to Hours of Service (April 2022, page 18):
John Doe drives Richmond, VA to Newark, NJ on 04/09/2021. The guide prints 350 total miles and these totals:
off duty 10, sleeper berth 1.75, driving 7.75, on duty (not driving) 4.5 hours, adding to 24.
"""

from datetime import datetime, timedelta, timezone

from trips.hos.models import DutyStatus, Event, EventType

DAY = datetime(2021, 4, 9, tzinfo=timezone(timedelta(hours=-4)))  # US Eastern time in April
TOTAL_MILES = 350
DRIVING_MINUTES = 465  # 7.75 hours

# (type, status, start "HH:MM", end "HH:MM", start place, end place)
STEPS = [
    (EventType.PICKUP, DutyStatus.ON_DUTY_NOT_DRIVING, "06:00", "07:30", "Richmond, VA", "Richmond, VA"),  # report, load, inspect
    (EventType.DRIVE, DutyStatus.DRIVING, "07:30", "09:00", "Richmond, VA", "Fredericksburg, VA"),
    (EventType.FUEL, DutyStatus.ON_DUTY_NOT_DRIVING, "09:00", "09:30", "Fredericksburg, VA", "Fredericksburg, VA"),
    (EventType.DRIVE, DutyStatus.DRIVING, "09:30", "12:00", "Fredericksburg, VA", "Baltimore, MD"),
    (EventType.BREAK, DutyStatus.OFF_DUTY, "12:00", "13:00", "Baltimore, MD", "Baltimore, MD"),  # lunch
    (EventType.DRIVE, DutyStatus.DRIVING, "13:00", "15:00", "Baltimore, MD", "Philadelphia, PA"),
    (EventType.DROPOFF, DutyStatus.ON_DUTY_NOT_DRIVING, "15:00", "15:30", "Philadelphia, PA", "Philadelphia, PA"),  # delivery stop
    (EventType.DRIVE, DutyStatus.DRIVING, "15:30", "16:00", "Philadelphia, PA", "Cherry Hill, NJ"),
    (EventType.REST, DutyStatus.SLEEPER_BERTH, "16:00", "17:45", "Cherry Hill, NJ", "Cherry Hill, NJ"),
    (EventType.DRIVE, DutyStatus.DRIVING, "17:45", "19:00", "Cherry Hill, NJ", "Newark, NJ"),
    (EventType.DROPOFF, DutyStatus.ON_DUTY_NOT_DRIVING, "19:00", "21:00", "Newark, NJ", "Newark, NJ"),  # post-trip, paperwork
]


def _at(clock):
    hour, minute = map(int, clock.split(":"))
    return DAY + timedelta(hours=hour, minutes=minute)


def build_example():
    """Returns (events, labels) for the guide's example day."""
    events, labels, miles = [], {}, 0.0
    for number, (kind, status, start, end, where_from, where_to) in enumerate(STEPS, start=1):
        begin, finish = _at(start), _at(end)
        driven = 0.0
        if status is DutyStatus.DRIVING:
            driven = TOTAL_MILES * ((finish - begin).total_seconds() / 60) / DRIVING_MINUTES
        events.append(
            Event(
                id=number,
                type=kind,
                duty_status=status,
                start=begin,
                end=finish,
                start_mile=miles,
                end_mile=miles + driven,
                reason="",
            )
        )
        labels[number] = {"start": where_from, "end": where_to}
        miles += driven
    return events, labels
