from bisect import bisect_right
from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_MILES = 3958.8


def haversine_miles(a, b):
    """Great-circle distance between two (lat, lon) points."""
    lat1, lon1, lat2, lon2 = map(radians, (a[0], a[1], b[0], b[1]))
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * asin(sqrt(h))


class RoutePath:
    """A route polyline that can be asked "where are we N miles in?".

    The routing service reports its own distance, which differs slightly from
    the straight-line sum over the polyline. Mileage is scaled so that the
    full route distance lands on the last point.
    """

    def __init__(self, points, distance_miles):
        if len(points) < 2:
            raise ValueError("a route needs at least two points")
        self.points = points
        self.distance_miles = distance_miles
        self._cumulative = [0.0]
        for before, after in zip(points, points[1:]):
            self._cumulative.append(self._cumulative[-1] + haversine_miles(before, after))
        self._length = self._cumulative[-1]

    def point_at(self, mile):
        mile = min(max(mile, 0.0), self.distance_miles)
        if self._length == 0:
            return self.points[0]
        target = mile / self.distance_miles * self._length if self.distance_miles else 0.0
        index = min(bisect_right(self._cumulative, target), len(self.points) - 1)
        low = self._cumulative[index - 1]
        span = self._cumulative[index] - low
        fraction = (target - low) / span if span else 0.0
        (lat1, lon1), (lat2, lon2) = self.points[index - 1], self.points[index]
        return (lat1 + (lat2 - lat1) * fraction, lon1 + (lon2 - lon1) * fraction)


def simplify(points, tolerance_miles=0.1):
    """Douglas-Peucker line simplification; keeps the first and last point.

    Uses a flat local projection, which is accurate enough at this tolerance.
    """
    if len(points) < 3:
        return list(points)

    mean_lat = radians(sum(p[0] for p in points) / len(points))
    miles_per_degree = EARTH_RADIUS_MILES * radians(1)
    xy = [(p[1] * cos(mean_lat) * miles_per_degree, p[0] * miles_per_degree) for p in points]

    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        (x1, y1), (x2, y2) = xy[first], xy[last]
        dx, dy = x2 - x1, y2 - y1
        length = sqrt(dx * dx + dy * dy)
        worst, worst_index = 0.0, None
        for i in range(first + 1, last):
            x, y = xy[i]
            if length == 0:
                distance = sqrt((x - x1) ** 2 + (y - y1) ** 2)
            else:
                distance = abs(dy * (x - x1) - dx * (y - y1)) / length
            if distance > worst:
                worst, worst_index = distance, i
        if worst_index is not None and worst > tolerance_miles:
            keep[worst_index] = True
            stack.append((first, worst_index))
            stack.append((worst_index, last))

    return [p for p, kept in zip(points, keep) if kept]
