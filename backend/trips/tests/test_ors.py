import pytest
import requests

from trips.exceptions import LocationNotFound, ProviderBusy, RouteNotFound, RoutingFailed
from trips.providers.ors import METERS_PER_MILE, OrsClient

from .fakes import FakeResponse, FakeSession

DALLAS = (32.78, -96.80)
FORT_WORTH = (32.75, -97.33)
AUSTIN = (30.27, -97.74)


def geocode_body(lon=-96.78, lat=32.73, label="Dallas, TX, USA"):
    return {"features": [{"geometry": {"coordinates": [lon, lat]}, "properties": {"label": label}}]}


def route_body(segments, coords):
    return {
        "features": [
            {
                "geometry": {"coordinates": coords},
                "properties": {"segments": [{"distance": d, "duration": t} for d, t in segments]},
            }
        ]
    }


def client(*responses):
    session = FakeSession(*responses)
    return OrsClient("test-key", session=session), session


def test_missing_key_is_reported_clearly():
    with pytest.raises(RoutingFailed):
        OrsClient("")


def test_geocode_returns_lat_lon_and_label():
    ors, session = client(FakeResponse(200, geocode_body()))
    place = ors.geocode("Dallas, TX")
    assert (place.lat, place.lon, place.label) == (32.73, -96.78, "Dallas, TX, USA")
    method, url, kwargs = session.calls[0]
    assert url.endswith("/geocode/search")
    assert kwargs["params"]["boundary.country"] == "US"
    assert kwargs["params"]["text"] == "Dallas, TX"


def test_geocode_results_are_cached_ignoring_case_and_spacing():
    ors, session = client(FakeResponse(200, geocode_body()))
    ors.geocode("Dallas, TX")
    ors.geocode("  dallas,   tx ")
    assert len(session.calls) == 1


def test_geocode_unknown_place():
    ors, _ = client(FakeResponse(200, {"features": []}))
    with pytest.raises(LocationNotFound) as error:
        ors.geocode("Nowhereville")
    assert "Nowhereville" in error.value.message


@pytest.mark.parametrize(
    "response, expected",
    [
        (requests.Timeout(), ProviderBusy),
        (requests.ConnectionError(), ProviderBusy),
        (FakeResponse(429), ProviderBusy),
        (FakeResponse(401), RoutingFailed),
        (FakeResponse(403), RoutingFailed),
        (FakeResponse(500), RoutingFailed),
    ],
)
def test_provider_failures_map_to_clean_errors(response, expected):
    ors, _ = client(response)
    with pytest.raises(expected):
        ors.geocode("Dallas, TX")


def test_route_sends_lon_lat_with_key_and_parses_legs():
    coords = [[-96.8, 32.78], [-97.33, 32.75], [-97.74, 30.27]]
    body = route_body([(60000, 3600), (300000, 11400)], coords)
    ors, session = client(FakeResponse(200, body))

    result = ors.route([DALLAS, FORT_WORTH, AUSTIN])

    method, url, kwargs = session.calls[0]
    assert url.endswith("/v2/directions/driving-hgv/geojson")
    assert kwargs["headers"] == {"Authorization": "test-key"}
    assert kwargs["json"]["coordinates"] == [[-96.80, 32.78], [-97.33, 32.75], [-97.74, 30.27]]
    assert kwargs["json"]["radiuses"] == [-1, -1, -1]

    assert result.legs[0].distance_miles == pytest.approx(60000 / METERS_PER_MILE)
    assert result.legs[0].duration_minutes == 60
    assert result.legs[1].duration_minutes == 190
    assert result.geometry[0] == (32.78, -96.8)  # swapped to (lat, lon)
    assert result.distance_miles == pytest.approx(360000 / METERS_PER_MILE)
    assert result.duration_minutes == 250


def test_route_with_repeated_point_skips_it_in_the_request_and_returns_a_zero_leg():
    body = route_body([(300000, 11400)], [[-96.8, 32.78], [-97.74, 30.27]])
    ors, session = client(FakeResponse(200, body))

    result = ors.route([DALLAS, DALLAS, AUSTIN])

    assert len(session.calls[0][2]["json"]["coordinates"]) == 2
    assert [(leg.distance_miles, leg.duration_minutes) for leg in result.legs][0] == (0.0, 0)
    assert result.legs[1].duration_minutes == 190


def test_route_between_identical_points_makes_no_request():
    ors, session = client()
    result = ors.route([DALLAS, DALLAS, DALLAS])
    assert session.calls == []
    assert [leg.duration_minutes for leg in result.legs] == [0, 0]
    assert len(result.geometry) == 2


def test_tiny_nonzero_leg_gets_at_least_one_minute():
    body = route_body([(50, 2)], [[-96.8, 32.78], [-96.81, 32.78]])
    ors, _ = client(FakeResponse(200, body))
    assert ors.route([DALLAS, (32.78, -96.81)]).legs[0].duration_minutes == 1


@pytest.mark.parametrize(
    "response",
    [
        FakeResponse(400, {"error": {"code": 2010, "message": "no point"}}),
        FakeResponse(400, {"error": {"code": 2009, "message": "no route"}}),
        FakeResponse(404, {}),
    ],
)
def test_no_route_cases_are_user_facing_422s(response):
    ors, _ = client(response)
    with pytest.raises(RouteNotFound) as error:
        ors.route([DALLAS, AUSTIN])
    assert error.value.status == 422


def test_trip_over_distance_limit_has_its_own_message():
    ors, _ = client(FakeResponse(400, {"error": {"code": 2004, "message": "limit"}}))
    with pytest.raises(RouteNotFound) as error:
        ors.route([DALLAS, AUSTIN])
    assert "longer than" in error.value.message


def test_unexpected_route_payload_is_a_routing_failure():
    ors, _ = client(FakeResponse(200, {"features": []}))
    with pytest.raises(RoutingFailed):
        ors.route([DALLAS, AUSTIN])


def test_wrong_number_of_legs_is_a_routing_failure():
    body = route_body([(1000, 60)], [[-96.8, 32.78], [-97.74, 30.27]])
    ors, _ = client(FakeResponse(200, body))
    with pytest.raises(RoutingFailed):
        ors.route([DALLAS, FORT_WORTH, AUSTIN])


def test_non_json_error_body_does_not_crash():
    ors, _ = client(FakeResponse(400, ValueError("not json")))
    with pytest.raises(RoutingFailed):
        ors.route([DALLAS, AUSTIN])
