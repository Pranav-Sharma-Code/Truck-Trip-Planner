import time
from functools import lru_cache

from django.conf import settings

from ..exceptions import ProviderBusy, RoutingFailed
from .nominatim import NominatimGeocoder
from .ors import OrsClient
from .overpass import FuelStationFinder

COOL_DOWN_SECONDS = 300


class FallbackGeocoder:

    def __init__(self, primary, backup, clock=time.monotonic, cool_down=COOL_DOWN_SECONDS):
        self.primary = primary
        self.backup = backup
        self._clock = clock
        self._cool_down = cool_down
        self._skip_until = 0.0

    def geocode(self, text, country=None, parts=None):
        if self._clock() >= self._skip_until:
            try:
                return self.primary.geocode(text, country, parts)
            except (ProviderBusy, RoutingFailed):
                self._skip_until = self._clock() + self._cool_down
        return self.backup.geocode(text, country, parts)


@lru_cache(maxsize=1)
def get_fuel_finder():
    if not settings.FUEL_STATIONS:
        return None
    return FuelStationFinder(settings.GEOCODER_USER_AGENT, settings.OVERPASS_URLS)


@lru_cache(maxsize=1)
def get_providers():
    ors = OrsClient(settings.ORS_API_KEY)
    if not settings.GEOCODER_FALLBACK:
        return ors, ors
    return FallbackGeocoder(ors, NominatimGeocoder(settings.GEOCODER_USER_AGENT)), ors
