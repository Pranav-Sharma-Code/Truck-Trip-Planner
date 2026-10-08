import time
from functools import lru_cache

from django.conf import settings

from ..exceptions import ProviderBusy, RoutingFailed
from .nominatim import NominatimGeocoder
from .ors import OrsClient
from .overpass import FuelStationFinder

COOL_DOWN_SECONDS = 300


class FallbackGeocoder:
    """Uses the main geocoder, and the backup when the main one is out of quota or down.

    After a failure the main geocoder is skipped for a few minutes, so a quota that ran out does not
    add a failed request in front of every lookup.
    """

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
    """The petrol station finder, or None when FUEL_STATIONS is turned off."""
    if not settings.FUEL_STATIONS:
        return None
    return FuelStationFinder(settings.GEOCODER_USER_AGENT, settings.OVERPASS_URLS)


@lru_cache(maxsize=1)
def get_providers():
    """Return (geocoder, router).

    One client is shared by every request, so its place cache keeps saving lookups. Routing always uses
    OpenRouteService; geocoding falls back to Nominatim (no key) if OpenRouteService cannot answer.
    """
    ors = OrsClient(settings.ORS_API_KEY)
    if not settings.GEOCODER_FALLBACK:
        return ors, ors
    return FallbackGeocoder(ors, NominatimGeocoder(settings.GEOCODER_USER_AGENT)), ors
