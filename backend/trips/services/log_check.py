"""Checks a set of (possibly hand-edited) daily logs against the hours-of-service rules.

The logs are joined into one timeline and run through the same validator that checks the planner's output, so
an edited log is judged by exactly the rules the plan was built to.
"""

from datetime import datetime, timedelta

from ..hos.models import DutyStatus, Event, EventType
from ..hos.validator import validate

# The validator only needs the duty status; the type is just a sensible label for each stretch.
EVENT_TYPES = {
    "DRIVING": EventType.DRIVE,
    "ON_DUTY_NOT_DRIVING": EventType.PICKUP,
    "OFF_DUTY": EventType.BREAK,
    "SLEEPER_BERTH": EventType.REST,
}


def check_logs(data):
    """`data` is the validated LogCheckSerializer output; returns {"ok", "violations"}."""
    events, where = [], {}
    for day in data["days"]:
        midnight = datetime.fromisoformat(f"{day['date'].isoformat()}T00:00:00{data['utc_offset']}")
        for segment in day["segments"]:
            event_id = len(events) + 1
            events.append(
                Event(
                    id=event_id,
                    type=EVENT_TYPES[segment["status"]],
                    duty_status=DutyStatus(segment["status"]),
                    start=midnight + timedelta(minutes=segment["start_minute"]),
                    end=midnight + timedelta(minutes=segment["end_minute"]),
                    start_mile=0.0,
                    end_mile=0.0,
                    reason="",
                )
            )
            where[event_id] = (day["date"].isoformat(), segment["start_minute"], segment["end_minute"])

    cycle_used = round(data["cycle_used_start_hours"] * 60)
    violations = [
        {
            "code": violation.code,
            "message": violation.message,
            "date": where[violation.event_id][0],
            "start_minute": where[violation.event_id][1],
            "end_minute": where[violation.event_id][2],
        }
        for violation in validate(events, cycle_used, check_fuel=False)
    ]
    return {"ok": not violations, "violations": violations}
