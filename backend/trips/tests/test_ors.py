import pytest
import requests

from trips.exceptions import LocationNotFound, ProviderBusy, RouteNotFound, RoutingFailed
from trips.providers.ors import METERS_PER_MILE, OrsClient, search_queries

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
    assert "boundary.country" not in kwargs["params"]  # any country is accepted
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


def test_geocode_limits_the_search_to_the_given_country():
    ors, session = client(FakeResponse(200, geocode_body(label="Pune, MH, India")))
    ors.geocode("Pune", country="IN")
    assert session.calls[0][2]["params"]["boundary.country"] == "IN"


def test_geocode_cache_keeps_countries_apart():
    ors, session = client(FakeResponse(200, geocode_body()), FakeResponse(200, geocode_body(label="Paris, France")))
    ors.geocode("Paris", country="US")
    ors.geocode("Paris", country="FR")
    ors.geocode("paris", country="FR")
    assert len(session.calls) == 2


def test_not_found_message_mentions_the_selected_country():
    ors, _ = client(FakeResponse(200, {"features": []}))
    with pytest.raises(LocationNotFound) as error:
        ors.geocode("Nowhereville", country="IN")
    assert "selected country" in error.value.message


def layered_body(layer, label, lon=77.59, lat=12.97):
    return {
        "features": [
            {"geometry": {"coordinates": [lon, lat]}, "properties": {"label": label, "layer": layer}}
        ]
    }


FULL_PARTS = {"place": "Bengaluru", "area": "Bengaluru Urban", "region": "Karnataka", "postal": "560001"}
FULL_TEXT = "Bengaluru, Bengaluru Urban, Karnataka, 560001"


def test_search_queries_without_parts_is_just_the_text():
    assert search_queries("Dallas, TX", None) == ["Dallas, TX"]


def test_search_queries_go_from_most_to_least_specific():
    assert search_queries(FULL_TEXT, FULL_PARTS) == [
        FULL_TEXT,
        "Bengaluru, Karnataka, 560001",
        "Bengaluru, Bengaluru Urban, Karnataka",
        "Bengaluru, Karnataka",
        "Bengaluru",
    ]


def test_search_queries_skip_parts_that_are_missing():
    parts = {"place": "Pune", "area": "", "region": "Maharashtra", "postal": ""}
    assert search_queries("Pune, Maharashtra", parts) == ["Pune, Maharashtra", "Pune"]


def test_search_queries_without_a_place_use_the_other_parts():
    parts = {"place": "", "area": "Pune", "region": "Maharashtra", "postal": "411001"}
    queries = search_queries("Pune, Maharashtra, 411001", parts)
    assert queries[0] == "Pune, Maharashtra, 411001"
    assert "Maharashtra, 411001" in queries and "411001" in queries
    assert all(not q.startswith("place") for q in queries)


def test_geocode_falls_back_when_the_full_address_only_matches_a_region():
    ors, session = client(
        FakeResponse(200, layered_body("region", "Karnataka, India")),
        FakeResponse(200, layered_body("locality", "Bangalore, KA, India")),
    )
    place = ors.geocode(FULL_TEXT, country="IN", parts=FULL_PARTS)

    assert place.label == "Bangalore, KA, India"
    asked = [call[2]["params"]["text"] for call in session.calls]
    assert asked == [FULL_TEXT, "Bengaluru, Karnataka, 560001"]
    assert all(call[2]["params"]["boundary.country"] == "IN" for call in session.calls)


def test_geocode_stops_at_the_first_specific_result():
    ors, session = client(FakeResponse(200, layered_body("address", "12 Main Street, Pune")))
    ors.geocode(FULL_TEXT, parts=FULL_PARTS)
    assert len(session.calls) == 1


def test_when_every_search_is_coarse_the_plain_place_name_result_wins():
    # The last, least specific search is the bare place name; if even that matches a region, the name
    # really is a region, so that result is trusted.
    queries = search_queries(FULL_TEXT, FULL_PARTS)
    coarse = [FakeResponse(200, layered_body("region", f"Karnataka {i}")) for i in range(len(queries))]
    ors, session = client(*coarse)
    place = ors.geocode(FULL_TEXT, parts=FULL_PARTS)
    assert place.label == f"Karnataka {len(queries) - 1}"
    assert len(session.calls) == len(queries)


def test_a_coarse_result_is_kept_if_the_remaining_searches_find_nothing():
    queries = search_queries(FULL_TEXT, FULL_PARTS)
    responses = [FakeResponse(200, layered_body("region", "Karnataka, India"))]
    responses += [FakeResponse(200, {"features": []}) for _ in queries[1:]]
    ors, _ = client(*responses)
    assert ors.geocode(FULL_TEXT, parts=FULL_PARTS).label == "Karnataka, India"


def test_a_place_that_is_itself_a_region_is_accepted_without_parts():
    ors, session = client(FakeResponse(200, layered_body("region", "Karnataka, India")))
    assert ors.geocode("Karnataka").label == "Karnataka, India"
    assert len(session.calls) == 1


def test_not_found_after_trying_every_search():
    queries = search_queries(FULL_TEXT, FULL_PARTS)
    ors, session = client(*[FakeResponse(200, {"features": []}) for _ in queries])
    with pytest.raises(LocationNotFound):
        ors.geocode(FULL_TEXT, parts=FULL_PARTS)
    assert len(session.calls) == len(queries)


@pytest.mark.parametrize("body", [{"error": "Quota exceeded"}, {"error": {"code": 4, "message": "Quota exceeded"}}])
def test_quota_exceeded_is_a_busy_error_not_a_bad_key(body):
    ors, _ = client(FakeResponse(403, body))
    with pytest.raises(ProviderBusy) as error:
        ors.geocode("Dallas, TX")
    assert "daily limit" in error.value.message
