from datetime import datetime

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from trips.exceptions import ProviderBusy, RoutingFailed
from trips.hos.daily_logs import MINUTES_PER_DAY

from .fakes import FakeGeocoder, FakeRouter

PLACES = {
    "Chicago, IL": (41.8781, -87.6298),
    "Indianapolis, IN": (39.7684, -86.1581),
    "Dallas, TX": (32.7767, -96.7970),
    "Dallas, Texas": (32.7767, -96.7970),
}
URL = "/api/trips/plan/"


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()


@pytest.fixture
def use_fakes(monkeypatch):
    def install(router=None):
        geocoder = FakeGeocoder(PLACES)
        monkeypatch.setattr("trips.views.get_providers", lambda: (geocoder, router or FakeRouter(mph=55, detour=1.2)))

    install()
    return install


def payload(**overrides):
    body = {
        "current_location": "Chicago, IL",
        "pickup_location": "Indianapolis, IN",
        "dropoff_location": "Dallas, TX",
        "current_cycle_used_hours": 20,
        "start_time": "2026-10-08T06:00:00-05:00",
    }
    body.update(overrides)
    return body


def post(body):
    return APIClient().post(URL, body, format="json")


def test_plan_returns_the_full_contract(use_fakes):
    response = post(payload())
    assert response.status_code == 200
    plan = response.json()

    assert set(plan) == {
        "locations", "route", "events", "daily_logs", "summary", "compliance", "warnings", "assumptions",
    }
    assert set(plan["locations"]) == {"current", "pickup", "dropoff"}
    assert plan["locations"]["pickup"]["label"] == "Indianapolis, IN, USA"
    assert plan["route"]["legs"][0]["from"] == "current"
    assert len(plan["route"]["geometry"]) >= 2
    assert plan["compliance"] == {"ok": True, "violations": []}


def test_events_are_contiguous_reasoned_and_located(use_fakes):
    plan = post(payload()).json()
    events = plan["events"]

    assert events[0]["type"] == "DRIVE"
    assert events[0]["location"]["label"] == "Chicago, IL"
    assert [e["type"] for e in events if e["type"] in ("PICKUP", "DROPOFF")] == ["PICKUP", "DROPOFF"]
    assert events[-1]["type"] == "DROPOFF"
    for before, after in zip(events, events[1:]):
        assert before["end"] == after["start"]
    for event in events:
        assert event["reason"]
        assert event["location"]["label"]
        assert "cycle_used_minutes" in event["clocks_after"]


def test_pickup_event_is_at_the_pickup_location(use_fakes):
    plan = post(payload()).json()
    pickup = next(e for e in plan["events"] if e["type"] == "PICKUP")
    assert pickup["location"]["label"] == "Indianapolis, IN"
    assert pickup["location"]["lat"] == pytest.approx(39.7684, abs=1e-4)


def test_long_trip_spans_days_and_every_sheet_adds_to_24_hours(use_fakes):
    plan = post(payload()).json()
    logs = plan["daily_logs"]

    assert len(logs) >= 2
    assert plan["summary"]["log_sheets"] == len(logs)
    assert plan["summary"]["rests"] >= 1
    for log in logs:
        assert sum(log["totals_minutes"].values()) == MINUTES_PER_DAY
    assert logs[0]["date"] == "2026-10-08"
    remark = logs[0]["remarks"][0]
    assert remark["location"] == "Chicago, IL"
    assert sum(log["total_miles"] for log in logs) == pytest.approx(plan["summary"]["total_miles"], abs=0.5 * len(logs))


def test_summary_tracks_cycle_hours(use_fakes):
    summary = post(payload(current_cycle_used_hours=20)).json()["summary"]
    assert summary["cycle_used_start_hours"] == 20
    assert summary["cycle_used_end_hours"] > 20
    assert summary["cycle_used_end_hours"] + summary["cycle_available_end_hours"] == pytest.approx(70)
    assert summary["start"] == "2026-10-08T06:00:00-05:00"
    assert datetime.fromisoformat(summary["arrival"]) > datetime.fromisoformat(summary["start"])


def test_cycle_nearly_used_triggers_a_restart_warning(use_fakes):
    plan = post(payload(current_cycle_used_hours=69.5)).json()
    assert plan["summary"]["restarts"] == 1
    assert [w["code"] for w in plan["warnings"]] == ["restart_scheduled"]
    assert plan["compliance"]["ok"] is True


def test_same_current_and_pickup_location_works(use_fakes):
    plan = post(payload(pickup_location="Chicago, IL")).json()
    assert plan["route"]["legs"][0]["distance_miles"] == 0
    assert plan["events"][0]["type"] == "PICKUP"


def test_start_time_is_optional(use_fakes):
    body = payload()
    del body["start_time"]
    response = post(body)
    assert response.status_code == 200
    assert response.json()["summary"]["start"].endswith("+00:00")


@pytest.mark.parametrize(
    "overrides, field",
    [
        ({"current_cycle_used_hours": -1}, "current_cycle_used_hours"),
        ({"current_cycle_used_hours": 70.1}, "current_cycle_used_hours"),
        ({"current_cycle_used_hours": "abc"}, "current_cycle_used_hours"),
        ({"current_cycle_used_hours": "nan"}, "current_cycle_used_hours"),
        ({"current_location": "   "}, "current_location"),
        ({"pickup_location": ""}, "pickup_location"),
        ({"dropoff_location": "x" * 201}, "dropoff_location"),
        ({"start_time": "2026-10-08T06:00:00"}, "start_time"),
        ({"start_time": "next tuesday"}, "start_time"),
    ],
)
def test_invalid_input_is_a_400_naming_the_field(use_fakes, overrides, field):
    response = post(payload(**overrides))
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "validation_error"
    assert body["field"] == field
    assert body["message"]


def test_missing_fields_are_reported(use_fakes):
    response = post({})
    assert response.status_code == 400
    assert set(response.json()["errors"]) == {
        "current_location", "pickup_location", "dropoff_location", "current_cycle_used_hours",
    }


def test_cycle_boundaries_are_accepted(use_fakes):
    assert post(payload(current_cycle_used_hours=0)).status_code == 200
    assert post(payload(current_cycle_used_hours=70)).status_code == 200


def test_unknown_location_names_the_field(use_fakes):
    response = post(payload(pickup_location="Atlantis"))
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "location_not_found"
    assert body["field"] == "pickup_location"
    assert "Atlantis" in body["message"]


@pytest.mark.parametrize(
    "error, status, code",
    [(ProviderBusy("busy"), 503, "provider_busy"), (RoutingFailed("down"), 502, "routing_failed")],
)
def test_routing_provider_failures(use_fakes, error, status, code):
    class BrokenRouter:
        def route(self, points):
            raise error

    use_fakes(BrokenRouter())
    response = post(payload())
    assert response.status_code == status
    assert response.json() == {"code": code, "message": error.message}


def test_unexpected_errors_return_clean_json(use_fakes):
    class CrashingRouter:
        def route(self, points):
            raise RuntimeError("boom")

    use_fakes(CrashingRouter())
    response = post(payload())
    assert response.status_code == 500
    assert response.json()["code"] == "server_error"
    assert "boom" not in response.content.decode()


def test_wrong_method_is_a_clean_405(use_fakes):
    response = APIClient().get(URL)
    assert response.status_code == 405
    assert response.json()["code"] == "request_error"


def test_requests_are_rate_limited(use_fakes):
    from rest_framework.throttling import AnonRateThrottle

    AnonRateThrottle.THROTTLE_RATES = {"anon": "3/min"}
    try:
        responses = [post(payload()) for _ in range(5)]
    finally:
        AnonRateThrottle.THROTTLE_RATES = {"anon": "30/min"}
    assert [r.status_code for r in responses] == [200, 200, 200, 429, 429]
    assert responses[-1].json()["code"] == "rate_limited"
    assert "Retry-After" in responses[-1]


def test_stops_at_a_typed_location_use_its_name_even_far_from_the_places_list(monkeypatch):
    # The geocoder's point for a big city can sit miles from the nearest town in the places list.
    geocoder = FakeGeocoder({**PLACES, "Phoenix, AZ": (33.80, -112.07)})
    monkeypatch.setattr("trips.views.get_providers", lambda: (geocoder, FakeRouter()))

    plan = post(payload(current_location="Phoenix, AZ", pickup_location="Phoenix, AZ")).json()

    assert plan["events"][0]["location"]["label"] == "Phoenix, AZ"
    pickup = next(e for e in plan["events"] if e["type"] == "PICKUP")
    assert pickup["location"]["label"] == "Phoenix, AZ"
    assert plan["daily_logs"][0]["from_label"] == "Phoenix, AZ"


def test_mid_route_stops_are_described_from_the_places_list(use_fakes):
    plan = post(payload()).json()
    rest = next(e for e in plan["events"] if e["type"] == "REST")
    assert rest["location"]["label"].endswith((", IL", ", IN", ", MO", ", AR", ", TX", ", OK", ", KY", ", TN", ", KS"))
    assert 0 < rest["start_mile"] < plan["summary"]["total_miles"]
