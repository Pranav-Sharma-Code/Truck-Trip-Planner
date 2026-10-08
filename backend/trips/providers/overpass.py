"""Finds real petrol stations near a point, using OpenStreetMap data through the Overpass API (no key needed).

Used to turn "a fuel stop is needed around here" into a named station. It never raises: if the service is slow,
busy or down, the answer is simply "none found" and the plan keeps its plain fuel stop.
"""

import logging
import time
from dataclasses import dataclass

import requests

from ..geo.geometry import haversine_miles

logger = logging.getLogger(__name__)

# The public servers are shared and sometimes answer "busy", so a few mirrors are tried in turn.
DEFAULT_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)
SEARCH_RADIUS_METERS = 8000  # about 5 miles either side of the route point
COOL_DOWN_SECONDS = 300  # after every server failed, skip lookups this long so plans are not slowed each time
UNNAMED = "Fuel station"


@dataclass(frozen=True)
class FuelStation:
    name: str
    lat: float
    lon: float
    distance_miles: float  # from the point that was searched


class FuelStationFinder:
    def __init__(
        self, user_agent, urls=DEFAULT_URLS, session=None, timeout=4, radius_meters=SEARCH_RADIUS_METERS,
        clock=time.monotonic, cool_down=COOL_DOWN_SECONDS,
    ):
        self.user_agent = user_agent
        self.urls = tuple(urls)
        self.session = session or requests.Session()
        self.timeout = timeout
        self.radius_meters = radius_meters
        self._clock = clock
        self._cool_down = cool_down
        self._skip_until = 0.0

    def nearest(self, lat, lon):
        """The closest named petrol station within the search radius, or None."""
        if self._clock() < self._skip_until:
            return None  # the servers failed a moment ago; do not make every plan wait for them again
        try:
            elements = self._query(lat, lon)
        except (requests.RequestException, ValueError, KeyError, TypeError) as error:
            logger.warning("Fuel station lookup failed: %s", error)
            self._skip_until = self._clock() + self._cool_down
            return None

        stations = []
        for element in elements:
            point = (element.get("lat"), element.get("lon"))
            if point[0] is None:  # ways (buildings) report their middle as "center"
                center = element.get("center") or {}
                point = (center.get("lat"), center.get("lon"))
            if point[0] is None or point[1] is None:
                continue
            tags = element.get("tags") or {}
            name = tags.get("name") or tags.get("brand") or tags.get("operator")
            stations.append(FuelStation(name or UNNAMED, point[0], point[1], haversine_miles((lat, lon), point)))

        if not stations:
            return None
        # A station with a name is more useful on a log than the nearest anonymous one.
        named = [station for station in stations if station.name != UNNAMED]
        return min(named or stations, key=lambda station: station.distance_miles)

    def _query(self, lat, lon):
        around = f"(around:{self.radius_meters},{lat},{lon})"
        query = f'[out:json][timeout:10];(node["amenity"="fuel"]{around};way["amenity"="fuel"]{around};);out center tags 40;'
        last_error = None
        for url in self.urls:
            try:
                response = self.session.post(
                    url,
                    data={"data": query},
                    headers={"User-Agent": self.user_agent},
                    timeout=self.timeout,
                )
                if response.status_code != 200:
                    raise ValueError(f"{url} answered {response.status_code}")
                return response.json()["elements"]
            except (requests.RequestException, ValueError, KeyError) as error:
                last_error = error  # try the next mirror
        raise last_error
