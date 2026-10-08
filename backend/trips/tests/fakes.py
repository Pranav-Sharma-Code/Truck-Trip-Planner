from trips.exceptions import LocationNotFound
from trips.providers.base import GeocodedLocation, RouteLeg, RouteResult


class FakeResponse:
    def __init__(self, status_code=200, body=None):
        self.status_code = status_code
        self._body = body if body is not None else {}

    def json(self):
        if isinstance(self._body, Exception):
            raise self._body
        return self._body


class FakeSession:
    """Stands in for requests.Session; replays queued responses and records calls."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def _next(self, method, url, kwargs):
        self.calls.append((method, url, kwargs))
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    def get(self, url, **kwargs):
        return self._next("get", url, kwargs)

    def post(self, url, **kwargs):
        return self._next("post", url, kwargs)


class FakeGeocoder:
    def __init__(self, places):
        self.places = places  # {"Dallas, TX": (lat, lon)} or (lat, lon, label)
        self.calls = []  # (text, country) for every lookup
        self.parts = []  # the address parts passed with each lookup

    def geocode(self, text, country=None, parts=None):
        self.calls.append((text, country))
        self.parts.append(parts)
        if text not in self.places:
            raise LocationNotFound(f'Could not find "{text}".')
        lat, lon, *label = self.places[text]
        return GeocodedLocation(input=text, label=label[0] if label else f"{text}, USA", lat=lat, lon=lon)


class FakeRouter:
    """Straight-line routing at a constant speed between the given points."""

    def __init__(self, mph=60, detour=1.0):
        self.mph = mph
        self.detour = detour

    def route(self, points):
        from trips.geo.geometry import haversine_miles

        legs = []
        for a, b in zip(points, points[1:]):
            miles = haversine_miles(a, b) * self.detour
            legs.append(RouteLeg(miles, round(miles / self.mph * 60) if miles else 0))
        return RouteResult(legs=legs, geometry=list(points))
