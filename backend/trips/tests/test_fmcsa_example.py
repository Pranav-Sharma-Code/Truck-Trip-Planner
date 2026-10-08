"""Checks the daily log builder against the worked example printed in the FMCSA guide."""

import pytest

from trips.hos.daily_logs import MINUTES_PER_DAY, build_daily_logs
from trips.hos.validator import validate

from .fmcsa_example import TOTAL_MILES, build_example


@pytest.fixture(scope="module")
def log():
    events, labels = build_example()
    logs = build_daily_logs(events, cycle_used_start_minutes=0, labels=labels)
    assert len(logs) == 1, "the example is a single calendar day"
    return logs[0]


def test_the_date_is_the_guides_date(log):
    assert log["date"] == "2021-04-09"


def test_totals_match_the_numbers_printed_in_the_guide(log):
    hours = log["totals_hours"]
    assert hours["OFF_DUTY"] == 10
    assert hours["SLEEPER_BERTH"] == 1.75
    assert hours["DRIVING"] == 7.75
    assert hours["ON_DUTY_NOT_DRIVING"] == 4.5


def test_the_day_adds_to_exactly_24_hours(log):
    assert sum(log["totals_minutes"].values()) == MINUTES_PER_DAY


def test_total_miles_driving_matches_the_guide(log):
    assert log["total_miles"] == pytest.approx(TOTAL_MILES, abs=0.1)


def test_the_duty_line_follows_the_story_in_the_guide(log):
    story = [
        ("OFF_DUTY", 0, 6 * 60),  # midnight to 6:00 a.m. off duty
        ("ON_DUTY_NOT_DRIVING", 6 * 60, 7 * 60 + 30),  # reported, loaded, inspected
        ("DRIVING", 7 * 60 + 30, 9 * 60),
        ("ON_DUTY_NOT_DRIVING", 9 * 60, 9 * 60 + 30),  # fuel
        ("DRIVING", 9 * 60 + 30, 12 * 60),
        ("OFF_DUTY", 12 * 60, 13 * 60),  # lunch
        ("DRIVING", 13 * 60, 15 * 60),
        ("ON_DUTY_NOT_DRIVING", 15 * 60, 15 * 60 + 30),  # delivery
        ("DRIVING", 15 * 60 + 30, 16 * 60),
        ("SLEEPER_BERTH", 16 * 60, 17 * 60 + 45),  # 4:00 to 5:45 p.m. in the sleeper
        ("DRIVING", 17 * 60 + 45, 19 * 60),
        ("ON_DUTY_NOT_DRIVING", 19 * 60, 21 * 60),  # post-trip and paperwork
        ("OFF_DUTY", 21 * 60, MINUTES_PER_DAY),  # off duty at 9:00 p.m.
    ]
    assert [(s["status"], s["start_minute"], s["end_minute"]) for s in log["segments"]] == story


def test_every_change_of_duty_status_has_a_place_in_the_remarks(log):
    places = [r["location"] for r in log["remarks"]]
    # The guide lists six places; every one of them appears, and none is missing a name.
    for place in ["Richmond, VA", "Fredericksburg, VA", "Baltimore, MD", "Philadelphia, PA", "Cherry Hill, NJ", "Newark, NJ"]:
        assert place in places
    assert all(places)
    assert [r["minute"] for r in log["remarks"]] == sorted(r["minute"] for r in log["remarks"])


def test_from_and_to_are_the_trip_ends(log):
    assert log["from_label"] == "Richmond, VA"
    assert log["to_label"] == "Newark, NJ"


def test_the_guides_own_example_is_legal_under_the_rules_we_enforce():
    events, _ = build_example()
    assert validate(events, cycle_used_minutes=0) == []
