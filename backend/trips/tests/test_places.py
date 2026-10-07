import random

import pytest

from trips.geo.geometry import haversine_miles
from trips.geo.places import get_place_index


@pytest.fixture(scope="module")
def index():
    return get_place_index()


def test_index_loads_a_realistic_number_of_places(index):
    assert len(index.places) > 5000


@pytest.mark.parametrize(
    "lat, lon, label",
    [
        (32.78, -96.80, "Dallas, TX"),
        (41.85, -87.65, "Chicago, IL"),
        (33.45, -112.07, "Phoenix, AZ"),
        (34.05, -118.24, "Los Angeles, CA"),
    ],
)
def test_nearest_finds_major_cities(index, lat, lon, label):
    place, distance = index.nearest(lat, lon)
    assert place.label == label
    assert distance < 5


def test_rural_point_gets_a_nearby_town_in_the_right_state(index):
    place, distance = index.nearest(42.9, -107.5)  # central Wyoming
    assert place.state == "WY"
    assert distance < 80


def test_point_far_outside_the_us_returns_none(index):
    assert index.nearest(35.0, -30.0) == (None, None)  # mid-Atlantic


def test_matches_brute_force_search(index):
    rng = random.Random(5)
    for _ in range(150):
        lat, lon = rng.uniform(26, 48), rng.uniform(-123, -69)
        place, distance = index.nearest(lat, lon)
        expected = min(haversine_miles((lat, lon), (p.lat, p.lon)) for p in index.places)
        assert distance == pytest.approx(expected, abs=1e-9), (lat, lon, place)
