
from . import constants as c
from .models import OFF_STATUSES, DutyStatus, EventType, Violation

EPSILON = 1e-6


def _minutes(delta):
    return int(delta.total_seconds() // 60)


def _runs(spans, predicate):
    runs = []
    for start, end, event in spans:
        if not predicate(event):
            continue
        if runs and runs[-1][1] == start:
            runs[-1] = (runs[-1][0], end)
        else:
            runs.append((start, end))
    return runs


def validate(events, cycle_used_minutes=0):
    if not events:
        return []

    origin = events[0].start
    spans = [(_minutes(e.start - origin), _minutes(e.end - origin), e) for e in events]
    violations = []

    previous_end = None
    for start, end, event in spans:
        if end <= start:
            violations.append(Violation("bad_duration", "Event has no positive duration.", event.id))
        if previous_end is not None and start < previous_end:
            violations.append(Violation("overlap", "Event starts before the previous one ends.", event.id))
        elif previous_end is not None and start > previous_end:
            violations.append(Violation("gap", "Unlogged time between events.", event.id))
        previous_end = end

    off_runs = _runs(spans, lambda e: e.duty_status in OFF_STATUSES)
    shift_resets = [r for r in off_runs if r[1] - r[0] >= c.SHIFT_RESET_OFF_DUTY]
    restarts = [r for r in off_runs if r[1] - r[0] >= c.RESTART_OFF_DUTY]
    breaks = [
        r
        for r in _runs(spans, lambda e: e.duty_status is not DutyStatus.DRIVING)
        if r[1] - r[0] >= c.BREAK_DURATION
    ]

    for start, end, event in spans:
        if event.duty_status is not DutyStatus.DRIVING:
            continue

        shift_begin = max((r[1] for r in shift_resets if r[1] <= start), default=0)
        in_shift = [s for s in spans if s[0] >= shift_begin and s[1] <= end]
        work_starts = [s[0] for s in in_shift if s[2].duty_status not in OFF_STATUSES]
        driven = sum(s[1] - s[0] for s in in_shift if s[2].duty_status is DutyStatus.DRIVING)

        if driven > c.MAX_DRIVING_PER_SHIFT:
            violations.append(
                Violation("driving_limit_11h", "More than 11 hours of driving since the last 10-hour rest.", event.id)
            )
        if work_starts and end - min(work_starts) > c.DUTY_WINDOW:
            violations.append(Violation("window_14h", "Driving after the 14th hour of the duty window.", event.id))

        break_end = max((r[1] for r in breaks if r[1] <= start), default=0)
        since_break = sum(
            s[1] - s[0]
            for s in spans
            if s[2].duty_status is DutyStatus.DRIVING and s[0] >= break_end and s[1] <= end
        )
        if since_break > c.DRIVING_BEFORE_BREAK:
            violations.append(
                Violation("break_8h", "More than 8 hours of driving without a 30-minute break.", event.id)
            )

        restart_end = max((r[1] for r in restarts if r[1] <= start), default=0)
        base = cycle_used_minutes if restart_end == 0 else 0
        on_duty = sum(
            s[1] - s[0]
            for s in spans
            if s[2].duty_status not in OFF_STATUSES and s[0] >= restart_end and s[1] <= end
        )
        if base + on_duty > c.CYCLE_LIMIT:
            violations.append(Violation("cycle_70h", "Driving past the 70-hour cycle limit.", event.id))

        last_fuel_mile = max(
            (e.end_mile for e in events if e.type is EventType.FUEL and e.end <= event.start),
            default=0.0,
        )
        if event.end_mile - last_fuel_mile > c.FUEL_INTERVAL_MILES + EPSILON:
            violations.append(
                Violation("fuel_1000mi", "More than 1,000 miles driven without fuelling.", event.id)
            )

    return violations
