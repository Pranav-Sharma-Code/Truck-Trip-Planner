

from datetime import timedelta

from . import constants as c
from .models import OFF_STATUSES, DutyStatus, EventType

MINUTES_PER_DAY = 24 * 60

REMARK_NOTES = {
    EventType.DRIVE: "Driving",
    EventType.PICKUP: "Pickup",
    EventType.DROPOFF: "Drop-off",
    EventType.FUEL: "Fuel stop",
    EventType.BREAK: "30-minute break",
    EventType.REST: "10-hour rest",
    EventType.RESTART: "34-hour restart",
}


def _minutes(delta):
    return int(delta.total_seconds() // 60)


def _merge(segments):
    merged = []
    for status, start, end in segments:
        if end <= start:
            continue
        if merged and merged[-1][0] == status and merged[-1][2] == start:
            merged[-1] = (status, merged[-1][1], end)
        else:
            merged.append((status, start, end))
    return merged


def _cycle_used_at(events, cycle_used_start, moment):
    used = cycle_used_start
    for event in events:
        if event.start >= moment:
            break
        portion = _minutes(min(event.end, moment) - event.start)
        if event.duty_status not in OFF_STATUSES:
            used += portion
        if event.type is EventType.RESTART and event.end <= moment:
            used = 0
    return used


def build_daily_logs(events, cycle_used_start_minutes=0, labels=None):
    """Return one dict per calendar day.

    `labels` optionally maps event id -> {"start": "City, ST", "end": "City, ST"}
    and is used for the remarks and the from/to fields.
    """
    if not events:
        return []

    labels = labels or {}
    tz = events[0].start.tzinfo
    first_day = events[0].start.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    last_end = events[-1].end.astimezone(tz)
    day_count = -(-_minutes(last_end - first_day) // MINUTES_PER_DAY)

    logs = []
    for index in range(day_count):
        day_start = first_day + timedelta(days=index)
        day_end = day_start + timedelta(days=1)
        logs.append(_build_day(events, cycle_used_start_minutes, labels, day_start, day_end))
    return logs


def _build_day(events, cycle_used_start, labels, day_start, day_end):
    segments = []
    remarks = []
    miles = 0.0
    touching = []
    cursor = 0

    for event in events:
        if event.end <= day_start or event.start >= day_end:
            continue
        touching.append(event)
        begin = _minutes(max(event.start, day_start) - day_start)
        end = _minutes(min(event.end, day_end) - day_start)

        if begin > cursor:
            segments.append((DutyStatus.OFF_DUTY, cursor, begin))
        segments.append((event.duty_status, begin, end))
        cursor = end

        if event.start >= day_start:
            remarks.append(
                {
                    "minute": begin,
                    "location": labels.get(event.id, {}).get("start"),
                    "note": REMARK_NOTES[event.type],
                }
            )
        if event.duty_status is DutyStatus.DRIVING:
            driven = event.end_mile - event.start_mile
            miles += driven * (end - begin) / event.duration_minutes

    if cursor < MINUTES_PER_DAY:
        segments.append((DutyStatus.OFF_DUTY, cursor, MINUTES_PER_DAY))
        if touching and touching[-1].end < day_end:
            remarks.append(
                {
                    "minute": cursor,
                    "location": labels.get(touching[-1].id, {}).get("end"),
                    "note": "Off duty",
                }
            )

    segments = _merge(segments)
    totals = {status.value: 0 for status in DutyStatus}
    for status, start, end in segments:
        totals[status.value] += end - start
    if sum(totals.values()) != MINUTES_PER_DAY:
        raise RuntimeError("daily log does not add up to 24 hours")

    on_duty = totals[DutyStatus.DRIVING.value] + totals[DutyStatus.ON_DUTY_NOT_DRIVING.value]
    cycle_used = _cycle_used_at(events, cycle_used_start, day_end)

    return {
        "date": day_start.date().isoformat(),
        "segments": [
            {"status": status.value, "start_minute": start, "end_minute": end}
            for status, start, end in segments
        ],
        "totals_minutes": totals,
        "totals_hours": {status: round(minutes / 60, 2) for status, minutes in totals.items()},
        "total_miles": round(miles, 1),
        "from_label": labels.get(touching[0].id, {}).get("start") if touching else None,
        "to_label": labels.get(touching[-1].id, {}).get("end") if touching else None,
        "remarks": remarks,
        "recap": {
            "on_duty_minutes_today": on_duty,
            "cycle_used_minutes": cycle_used,
            "cycle_available_minutes": max(0, c.CYCLE_LIMIT - cycle_used),
            "restart_completed": any(
                e.type is EventType.RESTART and day_start < e.end <= day_end for e in touching
            ),
        },
    }
