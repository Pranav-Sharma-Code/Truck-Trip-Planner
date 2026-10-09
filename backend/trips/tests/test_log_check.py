import pytest
from rest_framework.test import APIClient

from trips.hos.models import DutyStatus, EventType
from trips.hos.validator import validate

from .helpers import drive, make_events, off_duty

URL = "/api/logs/check/"


def segs(*rows):
    """(status, start "HH:MM", end "HH:MM") rows to the API shape; "24:00" means midnight."""

    def minute(clock):
        hour, mins = map(int, clock.split(":"))
        return hour * 60 + mins

    return [{"status": s, "start_minute": minute(a), "end_minute": minute(b)} for s, a, b in rows]


def body(*days, offset="+00:00", cycle=0):
    return {
        "utc_offset": offset,
        "cycle_used_start_hours": cycle,
        "days": [{"date": date, "segments": segments} for date, segments in days],
    }


def post(payload):
    return APIClient().post(URL, payload, format="json")


LEGAL_DAY = segs(
    ("OFF_DUTY", "00:00", "06:00"),
    ("ON_DUTY_NOT_DRIVING", "06:00", "07:00"),
    ("DRIVING", "07:00", "13:00"),
    ("OFF_DUTY", "13:00", "13:30"),
    ("DRIVING", "13:30", "17:30"),
    ("OFF_DUTY", "17:30", "24:00"),
)


def test_a_legal_day_has_no_violations():
    response = post(body(("2026-10-08", LEGAL_DAY)))
    assert response.status_code == 200
    assert response.json() == {"ok": True, "violations": []}


def test_driving_past_eleven_hours_is_reported_with_its_day_and_time():
    day = segs(
        ("OFF_DUTY", "00:00", "05:00"),
        ("DRIVING", "05:00", "13:00"),
        ("OFF_DUTY", "13:00", "13:30"),
        ("DRIVING", "13:30", "18:00"),  # 8h + 4.5h = 12.5h of driving
        ("OFF_DUTY", "18:00", "24:00"),
    )
    result = post(body(("2026-10-08", day))).json()

    assert result["ok"] is False
    codes = {v["code"] for v in result["violations"]}
    assert "driving_limit_11h" in codes
    violation = next(v for v in result["violations"] if v["code"] == "driving_limit_11h")
    assert violation["date"] == "2026-10-08"
    assert (violation["start_minute"], violation["end_minute"]) == (13 * 60 + 30, 18 * 60)


def test_eight_hours_without_a_break_is_reported():
    day = segs(("OFF_DUTY", "00:00", "06:00"), ("DRIVING", "06:00", "15:00"), ("OFF_DUTY", "15:00", "24:00"))
    codes = {v["code"] for v in post(body(("2026-10-08", day))).json()["violations"]}
    assert "break_8h" in codes


def test_rules_carry_across_midnight_between_days():
    first = segs(("OFF_DUTY", "00:00", "14:00"), ("DRIVING", "14:00", "24:00"))  # 10 h driving
    second = segs(("DRIVING", "00:00", "03:00"), ("OFF_DUTY", "03:00", "24:00"))  # 13 h in one shift
    result = post(body(("2026-10-08", first), ("2026-10-09", second))).json()
    assert any(v["code"] == "driving_limit_11h" and v["date"] == "2026-10-09" for v in result["violations"])


def test_a_ten_hour_rest_between_days_resets_the_clocks():
    first = segs(("OFF_DUTY", "00:00", "13:00"), ("DRIVING", "13:00", "21:00"), ("OFF_DUTY", "21:00", "24:00"))
    second = segs(("OFF_DUTY", "00:00", "07:00"), ("DRIVING", "07:00", "15:00"), ("OFF_DUTY", "15:00", "24:00"))
    assert post(body(("2026-10-08", first), ("2026-10-09", second))).json()["ok"] is True


def test_cycle_hours_used_before_the_trip_count():
    day = segs(("OFF_DUTY", "00:00", "06:00"), ("DRIVING", "06:00", "10:00"), ("OFF_DUTY", "10:00", "24:00"))
    assert post(body(("2026-10-08", day), cycle=69)).json()["ok"] is False
    assert post(body(("2026-10-08", day), cycle=60)).json()["ok"] is True


def test_the_same_rules_as_the_planner_checker_are_used():
    events = make_events([off_duty(360), drive(540, miles=300), off_duty(540)])  # 9 h straight
    expected = {v.code for v in validate(events, check_fuel=False)}
    day = segs(("OFF_DUTY", "00:00", "06:00"), ("DRIVING", "06:00", "15:00"), ("OFF_DUTY", "15:00", "24:00"))
    got = {v["code"] for v in post(body(("2026-10-08", day))).json()["violations"]}
    assert got == expected == {"break_8h"}


def test_fuel_is_not_checked_for_a_hand_written_log():
    events = make_events([(EventType.DRIVE, DutyStatus.DRIVING, 120, 1500.0)])
    assert any(v.code == "fuel_1000mi" for v in validate(events))
    assert validate(events, check_fuel=False) == []


@pytest.mark.parametrize(
    "segments",
    [
        segs(("DRIVING", "00:00", "12:00")),  # stops at noon
        segs(("OFF_DUTY", "00:00", "10:00"), ("DRIVING", "11:00", "24:00")),  # gap
        segs(("OFF_DUTY", "00:00", "13:00"), ("DRIVING", "12:00", "24:00")),  # overlap
        segs(("OFF_DUTY", "01:00", "24:00")),  # does not start at midnight
        [],
        [{"status": "NAPPING", "start_minute": 0, "end_minute": 1440}],
    ],
)
def test_malformed_days_are_a_400(segments):
    response = post(body(("2026-10-08", segments)))
    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"


def test_days_must_be_consecutive():
    response = post(body(("2026-10-08", LEGAL_DAY), ("2026-10-10", LEGAL_DAY)))
    assert response.status_code == 400
    assert response.json()["field"] == "days"


@pytest.mark.parametrize("offset", ["5:30", "+0530", "IST", ""])
def test_the_utc_offset_must_look_like_plus_or_minus_hh_mm(offset):
    response = post(body(("2026-10-08", LEGAL_DAY), offset=offset))
    assert response.status_code == 400
    assert response.json()["field"] == "utc_offset"


def test_a_non_zero_offset_gives_the_same_verdict():
    assert post(body(("2026-10-08", LEGAL_DAY), offset="+05:30")).json()["ok"] is True


def test_it_is_not_rate_limited():
    client = APIClient()
    payload = body(("2026-10-08", LEGAL_DAY))
    assert all(client.post(URL, payload, format="json").status_code == 200 for _ in range(40))
