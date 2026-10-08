"""OpenRouteService client: geocoding and heavy-goods-vehicle routing."""

import requests

from ..exceptions import LocationNotFound, ProviderBusy, RouteNotFound, RoutingFailed
from .base import GeocodedLocation, RouteLeg, RouteResult

METERS_PER_MILE = 1609.344
DEFAULT_BASE_URL = "https://api.openrouteservice.org"
CACHE_LIMIT = 500
ORS_DISTANCE_LIMIT = 2004  # route longer than 6,000 km
ORS_NO_ROUTE = (2009, 2010)  # route not found / no routable point near a coordinate


# Result layers coarser than a city. For a typed place these mean "could not match the details".
COARSE_LAYERS = {"region", "macroregion", "dependency", "country", "continent", "empire", "ocean", "marinearea"}

# Which address parts to combine, most specific first. Each search drops detail that may not match.
QUERY_COMBINATIONS = (
    ("place", "area", "region", "postal"),
    ("place", "region", "postal"),
    ("place", "area", "region"),
    ("place", "region"),
    ("place",),
    # no place typed: a postal code or area is all there is
    ("area", "region", "postal"),
    ("region", "postal"),
    ("area", "region"),
    ("postal",),
    ("area",),
    ("region",),
)


def search_queries(text, parts):
    """Search texts to try, most specific first. Without `parts` it is just `text`."""
    if not parts:
        return [text]
    clean = {name: (parts.get(name) or "").strip() for name in ("place", "area", "region", "postal")}
    queries = [text]
    for combination in QUERY_COMBINATIONS:
        if combination[0] != "place" and clean["place"]:
            continue  # only worth it when no place was typed
        if any(not clean[name] for name in combination):
            continue
        query = ", ".join(clean[name] for name in combination)
        if query not in queries:
            queries.append(query)
    return queries


def _same_point(a, b):
    return round(a[0], 5) == round(b[0], 5) and round(a[1], 5) == round(b[1], 5)


class OrsClient:
    def __init__(self, api_key, base_url=DEFAULT_BASE_URL, session=None, timeout=15):
        if not api_key:
            raise RoutingFailed("The routing service is not configured (missing ORS_API_KEY).")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.session = session or requests.Session()
        self.timeout = timeout
        self._geocode_cache = {}

    def geocode(self, text, country=None, parts=None):
        """Find a place.

        `country` (ISO alpha-2, optional) limits the search to that country. `parts` is the address
        split into place, area, region and postal; with it the most specific search is tried first and
        looser ones after, because a free-text search that cannot match every part can fall back to just
        the state or country.
        """
        key = (" ".join(text.lower().split()), country)
        if key in self._geocode_cache:
            return self._geocode_cache[key]

        queries = search_queries(text, parts)
        accepted, too_coarse = None, None
        for query in queries:
            feature = self._search(query, country)
            if feature is None:
                continue
            if feature["properties"].get("layer") in COARSE_LAYERS and query != queries[-1]:
                too_coarse = too_coarse or feature  # keep it in case nothing better turns up
                continue
            accepted = feature
            break
        accepted = accepted or too_coarse
        if accepted is None:
            where = "in the selected country" if country else "anywhere"
            raise LocationNotFound(
                f'Could not find "{text}" {where}. Check the spelling, or add a state, district or postal code.'
            )

        lon, lat = accepted["geometry"]["coordinates"][:2]
        label = accepted["properties"].get("label") or text
        location = GeocodedLocation(input=text, label=label, lat=lat, lon=lon)

        if len(self._geocode_cache) >= CACHE_LIMIT:
            self._geocode_cache.clear()
        self._geocode_cache[key] = location
        return location

    def _search(self, query, country):
        """The best match for one search text, or None."""
        params = {"api_key": self.api_key, "text": query, "size": 1}
        if country:
            params["boundary.country"] = country
        features = self._request("get", "/geocode/search", params=params).get("features") or []
        if not features:
            return None
        feature = features[0]
        feature.setdefault("properties", {})
        return feature

    def route(self, points):
        """Route through (lat, lon) points; consecutive identical points become zero-length legs."""
        if len(points) < 2:
            raise ValueError("a route needs at least two points")

        waypoints = [points[0]]
        for point in points[1:]:
            if not _same_point(point, waypoints[-1]):
                waypoints.append(point)

        if len(waypoints) == 1:
            return RouteResult(
                legs=[RouteLeg(0.0, 0) for _ in points[1:]],
                geometry=[points[0], points[0]],
            )

        data = self._request(
            "post",
            "/v2/directions/driving-hgv/geojson",
            json={
                "coordinates": [[lon, lat] for lat, lon in waypoints],
                # Instructions stay on: without them the response has no per-leg distances and durations.
                # -1 lets the router snap city-centre coordinates to the nearest road at any distance.
                "radiuses": [-1] * len(waypoints),
            },
        )
        try:
            feature = data["features"][0]
            segments = feature["properties"]["segments"]
            geometry = [(lat, lon) for lon, lat, *_ in feature["geometry"]["coordinates"]]
        except (KeyError, IndexError, TypeError):
            raise RoutingFailed("The routing service returned an unexpected response.")

        real_legs = [self._leg(segment) for segment in segments]
        if len(real_legs) != len(waypoints) - 1:
            raise RoutingFailed("The routing service returned an unexpected number of legs.")

        legs, real = [], iter(real_legs)
        previous = points[0]
        for point in points[1:]:
            legs.append(RouteLeg(0.0, 0) if _same_point(point, previous) else next(real))
            previous = point
        return RouteResult(legs=legs, geometry=geometry)

    @staticmethod
    def _leg(segment):
        miles = segment["distance"] / METERS_PER_MILE
        minutes = round(segment["duration"] / 60)
        if miles > 0:
            minutes = max(1, minutes)
        return RouteLeg(distance_miles=miles, duration_minutes=minutes)

    def _request(self, method, path, **kwargs):
        headers = {"Authorization": self.api_key} if method == "post" else {}
        try:
            response = getattr(self.session, method)(
                self.base_url + path, headers=headers, timeout=self.timeout, **kwargs
            )
        except (requests.Timeout, requests.ConnectionError):
            raise ProviderBusy("The routing service did not respond. Please try again in a moment.")

        status = response.status_code
        if status == 200:
            return response.json()
        if status == 429:
            raise ProviderBusy("The routing service is busy right now. Please try again shortly.")
        if status in (401, 403):
            if "quota" in self._error_text(response):
                raise ProviderBusy("The map service has reached its daily limit. Please try again later.")
            raise RoutingFailed("The routing service rejected the API key.")
        code = self._error_code(response)
        if code == ORS_DISTANCE_LIMIT:
            raise RouteNotFound(
                "This trip is longer than the routing service allows (about 3,700 miles in total)."
            )
        if status == 404 or code in ORS_NO_ROUTE:
            raise RouteNotFound("No drivable route was found between those locations.")
        raise RoutingFailed("The routing service could not plan this route.")

    @staticmethod
    def _error_text(response):
        try:
            error = response.json().get("error")
        except (ValueError, AttributeError):
            return ""
        message = error.get("message") if isinstance(error, dict) else error
        return str(message or "").lower()

    @staticmethod
    def _error_code(response):
        try:
            error = response.json().get("error")
        except ValueError:
            return None
        return error.get("code") if isinstance(error, dict) else None
