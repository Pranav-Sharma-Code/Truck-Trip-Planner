import time

import pytest
import requests
from rest_framework.test import APIClient

from trips.providers.overpass import UNNAMED, FuelStation, FuelStationFinder

from .fakes import FakeGeocoder, FakeResponse, FakeSession, FakeRouter

POINT = (18.52, 73.85)


def node(lat, lon, **tags):
    return {"type": "node", "id": 1, "lat": lat, "lon": lon, "tags": tags}


def finder(*responses):
    session = FakeSession(*responses)
    return FuelStationFinder("Test-Agent/1.0", urls=["http://overpass.test/api", "http://mirror.test/api"], session=session), session


def overpass(*elements):
    return FakeResponse(200, {"elements": list(elements)})


def test_finds_the_nearest_named_station():
    near_unnamed = node(18.5201, 73.8501)
    named_farther = node(18.55, 73.88, name="Indian Oil")
    named_nearest = node(18.53, 73.86, name="HP Petrol Pump")
    station_finder, session = finder(overpass(near_unnamed, named_farther, named_nearest))

    station = station_finder.nearest(*POINT)

    assert (station.name, station.lat, station.lon) == ("HP Petrol Pump", 18.53, 73.86)
    method, url, kwargs = session.calls[0]
    assert method == "post" and url == "http://overpass.test/api"
    assert 'amenity"="fuel"' in kwargs["data"]["data"]
    assert f"around:8000,{POINT[0]},{POINT[1]}" in kwargs["data"]["data"]
    assert kwargs["headers"]["User-Agent"] == "Test-Agent/1.0"


def test_falls_back_to_brand_or_operator_for_the_name():
    assert finder(overpass(node(18.5, 73.8, brand="Shell")))[0].nearest(*POINT).name == "Shell"
    assert finder(overpass(node(18.5, 73.8, operator="BPCL")))[0].nearest(*POINT).name == "BPCL"


def test_an_unnamed_station_is_better_than_none():
    station = finder(overpass(node(18.5, 73.8)))[0].nearest(*POINT)
    assert station.name == UNNAMED


def test_uses_the_centre_of_a_way():
    way = {"type": "way", "id": 2, "center": {"lat": 18.51, "lon": 73.84}, "tags": {"name": "Reliance"}}
    station = finder(overpass(way))[0].nearest(*POINT)
    assert (station.name, station.lat, station.lon) == ("Reliance", 18.51, 73.84)


def test_no_stations_gives_none():
    assert finder(overpass())[0].nearest(*POINT) is None


@pytest.mark.parametrize(
    "response",
    [
        requests.Timeout(),
        requests.ConnectionError(),
        FakeResponse(429, {}),
        FakeResponse(504, {}),
        FakeResponse(200, {"unexpected": True}),
        FakeResponse(200, {"elements": [{"tags": {}}]}),
    ],
)
def test_a_failing_or_odd_response_never_raises(response):
    # the same bad answer from both servers
    assert finder(response, response)[0].nearest(*POINT) is None


def test_a_busy_server_hands_over_to_the_next_mirror():
    station_finder, session = finder(FakeResponse(504, {}), overpass(node(18.53, 73.86, name="HP Petrol Pump")))
    station = station_finder.nearest(*POINT)
    assert station.name == "HP Petrol Pump"
    assert [call[1] for call in session.calls] == ["http://overpass.test/api", "http://mirror.test/api"]


def test_a_timeout_also_hands_over_to_the_next_mirror():
    station_finder, _ = finder(requests.Timeout(), overpass(node(18.53, 73.86, name="Shell")))
    assert station_finder.nearest(*POINT).name == "Shell"


def test_the_first_mirror_is_not_bothered_when_it_answers():
    station_finder, session = finder(overpass(node(18.53, 73.86, name="Shell")))
    station_finder.nearest(*POINT)
    assert len(session.calls) == 1


# --- through the planner and API -----------------------------------------------------------------------------

PLACES = {
    "Chicago, IL": (41.8781, -87.6298),
    "Indianapolis, IN": (39.7684, -86.1581),
    "Dallas, TX": (32.7767, -96.7970),
}
BODY = {
    "current_location": "Chicago, IL",
    "pickup_location": "Indianapolis, IN",
    "dropoff_location": "Dallas, TX",
    "current_cycle_used_hours": 5,
    "start_time": "2026-10-08T06:00:00-05:00",
}


class StubFinder:
    def __init__(self, result=None, delay=0, error=None):
        self.result, self.delay, self.error, self.points = result, delay, error, []

    def nearest(self, lat, lon):
        self.points.append((lat, lon))
        time.sleep(self.delay)
        if self.error:
            raise self.error
        return self.result


@pytest.fixture
def api(monkeypatch):
    # a winding route, so the trip is long enough to need fuel
    monkeypatch.setattr(
        "trips.views.get_providers", lambda: (FakeGeocoder(PLACES), FakeRouter(mph=60, detour=1.5))
    )

    def call(finder):
        monkeypatch.setattr("trips.views.get_fuel_finder", lambda: finder)
        return APIClient().post("/api/trips/plan/", BODY, format="json")

    return call


def fuel_events(response):
    return [e for e in response.json()["events"] if e["type"] == "FUEL"]


def test_a_fuel_stop_is_placed_at_the_station_that_was_found(api):
    station = FuelStation("Pilot Travel Center", 36.1, -90.2, 1.2)
    response = api(StubFinder(station))

    assert response.status_code == 200
    stops = fuel_events(response)
    assert stops, "this trip needs at least one fuel stop"
    for stop in stops:
        assert stop["station"] == {"name": "Pilot Travel Center", "lat": 36.1, "lon": -90.2}
        assert stop["location"]["label"].startswith("Pilot Travel Center, ")
        assert (stop["location"]["lat"], stop["location"]["lon"]) == (36.1, -90.2)


def test_the_log_remarks_name_the_station(api):
    response = api(StubFinder(FuelStation("Pilot Travel Center", 36.1, -90.2, 1.2)))
    remarks = [r for log in response.json()["daily_logs"] for r in log["remarks"] if r["note"] == "Fuel stop"]
    assert remarks and all(r["location"].startswith("Pilot Travel Center") for r in remarks)


def test_the_plan_says_how_fuel_stops_were_placed(api):
    assumptions = api(StubFinder(FuelStation("X", 36.1, -90.2, 1.0))).json()["assumptions"]
    assert any("real petrol station" in text for text in assumptions)


def test_the_fuel_stop_stays_on_schedule(api):
    plain = api(None)
    named = api(StubFinder(FuelStation("X", 36.1, -90.2, 1.0)))
    strip = lambda r: [(e["type"], e["start"], e["end"], e["start_mile"]) for e in r.json()["events"]]
    assert strip(plain) == strip(named)  # naming a station changes the place, never the timing
    assert plain.json()["compliance"]["ok"] and named.json()["compliance"]["ok"]


@pytest.mark.parametrize("finder", [None, StubFinder(None), StubFinder(error=RuntimeError("down"))])
def test_without_a_station_the_plan_is_the_same_as_before(api, finder):
    response = api(finder)
    assert response.status_code == 200
    stops = fuel_events(response)
    assert stops and all(stop["station"] is None for stop in stops)
    assert not any("real petrol station" in text for text in response.json()["assumptions"])


def test_the_search_is_made_at_the_point_on_the_route_where_fuel_is_due(api):
    stub = StubFinder(None)
    response = api(stub)
    stops = fuel_events(response)
    assert len(stub.points) == len(stops)
    # every search point lies between the start and the drop-off, not at some far-off place
    assert all(32 < lat < 42 for lat, _ in stub.points)


def test_a_very_slow_lookup_does_not_hold_up_the_plan(api, monkeypatch):
    monkeypatch.setattr("trips.services.planner.FUEL_LOOKUP_WAIT_SECONDS", 0.2)
    started = time.monotonic()
    response = api(StubFinder(FuelStation("Late", 36.1, -90.2, 1.0), delay=1.5))
    assert response.status_code == 200
    assert time.monotonic() - started < 1.2
    assert all(stop["station"] is None for stop in fuel_events(response))



def test_after_every_server_fails_lookups_pause_for_a_while():
    now = [0.0]
    session = FakeSession(FakeResponse(504, {}), FakeResponse(504, {}), overpass(node(18.53, 73.86, name="Shell")))
    station_finder = FuelStationFinder(
        "Test-Agent/1.0", urls=["http://a.test", "http://b.test"], session=session, clock=lambda: now[0], cool_down=300
    )

    assert station_finder.nearest(*POINT) is None  # both servers failed
    assert station_finder.nearest(*POINT) is None  # paused: no request is made
    assert len(session.calls) == 2

    now[0] = 301
    assert station_finder.nearest(*POINT).name == "Shell"  # pause over: it tries again
    assert len(session.calls) == 3


def test_a_lookup_that_simply_finds_nothing_does_not_start_a_pause():
    now = [0.0]
    session = FakeSession(overpass(), overpass(node(18.53, 73.86, name="Shell")))
    station_finder = FuelStationFinder("Test-Agent/1.0", urls=["http://a.test"], session=session, clock=lambda: now[0])
    assert station_finder.nearest(*POINT) is None
    assert station_finder.nearest(*POINT).name == "Shell"
