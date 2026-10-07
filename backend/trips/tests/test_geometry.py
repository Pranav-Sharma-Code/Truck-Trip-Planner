import random

import pytest

from trips.geo.geometry import RoutePath, haversine_miles, simplify

DALLAS = (32.7767, -96.7970)
HOUSTON = (29.7604, -95.3698)


def test_haversine_dallas_to_houston():
    assert 220 < haversine_miles(DALLAS, HOUSTON) < 230


def test_haversine_same_point_is_zero():
    assert haversine_miles(DALLAS, DALLAS) == 0


def test_point_at_mile_interpolates_along_a_segment():
    path = RoutePath([(0.0, 0.0), (0.0, 1.0)], distance_miles=100)
    lat, lon = path.point_at(50)
    assert lat == pytest.approx(0.0)
    assert lon == pytest.approx(0.5, abs=1e-6)


def test_point_at_mile_clamps_to_the_ends():
    path = RoutePath([(0.0, 0.0), (0.0, 1.0)], distance_miles=100)
    assert path.point_at(-5) == (0.0, 0.0)
    assert path.point_at(500) == pytest.approx((0.0, 1.0))


def test_point_at_mile_scales_to_the_provider_distance():
    # Polyline is ~69 miles long but the provider says 120: mile 60 is halfway.
    path = RoutePath([(0.0, 0.0), (0.0, 1.0)], distance_miles=120)
    assert path.point_at(60)[1] == pytest.approx(0.5, abs=1e-6)


def test_point_at_mile_follows_a_bend():
    path = RoutePath([(0.0, 0.0), (0.0, 1.0), (1.0, 1.0)], distance_miles=138)
    lat, lon = path.point_at(138 * 0.75)
    assert lon == pytest.approx(1.0, abs=0.01)
    assert 0.4 < lat < 0.6


def test_route_needs_two_points():
    with pytest.raises(ValueError):
        RoutePath([(0.0, 0.0)], 10)


def test_simplify_drops_collinear_points_but_keeps_ends_and_corners():
    line = [(0.0, 0.0), (0.0, 0.5), (0.0, 1.0), (0.5, 1.0), (1.0, 1.0)]
    assert simplify(line, 0.1) == [(0.0, 0.0), (0.0, 1.0), (1.0, 1.0)]


def test_simplify_keeps_small_inputs_unchanged():
    assert simplify([(0.0, 0.0), (1.0, 1.0)]) == [(0.0, 0.0), (1.0, 1.0)]


def test_simplify_stays_within_tolerance_on_a_noisy_line():
    rng = random.Random(3)
    points = [(30 + i * 0.01, -90 + rng.uniform(-0.0005, 0.0005)) for i in range(1000)]
    result = simplify(points, tolerance_miles=0.5)
    assert len(result) < 50
    assert result[0] == points[0] and result[-1] == points[-1]
