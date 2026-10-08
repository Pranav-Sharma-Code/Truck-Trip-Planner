

import threading
import time

import requests

from ..exceptions import LocationNotFound, ProviderBusy
from .base import GeocodedLocation

BASE_URL = "https://nominatim.openstreetmap.org"
MIN_INTERVAL_SECONDS = 1.1
CITY_KEYS = ("city", "town", "village", "municipality", "hamlet", "suburb", "county", "state_district")


class NominatimGeocoder:
    def __init__(self, user_agent, session=None, timeout=10, base_url=BASE_URL, sleep=time.sleep, clock=time.monotonic):
        self.user_agent = user_agent
        self.session = session or requests.Session()
        self.timeout = timeout
        self.base_url = base_url.rstrip("/")
        self._sleep = sleep
        self._clock = clock
        self._lock = threading.Lock()
        self._last_call = None

    def geocode(self, text, country=None, parts=None):
        params = {"q": text, "format": "jsonv2", "limit": 1, "addressdetails": 1}
        if country:
            params["countrycodes"] = country.lower()

        results = self._get(params)
        if not results and parts and parts.get("place"):
            # The full address can be too specific for this service; try the place and region alone.
            simpler = ", ".join(filter(None, (parts["place"].strip(), (parts.get("region") or "").strip())))
            if simpler and simpler != text:
                results = self._get({**params, "q": simpler})
        if not results:
            where = "in the selected country" if country else "anywhere"
            raise LocationNotFound(
                f'Could not find "{text}" {where}. Check the spelling, or add a state, district or postal code.'
            )

        item = results[0]
        return GeocodedLocation(
            input=text,
            label=self._label(item, text),
            lat=float(item["lat"]),
            lon=float(item["lon"]),
        )

    def _get(self, params):
        with self._lock:  # one request at a time, at least MIN_INTERVAL_SECONDS apart
            if self._last_call is not None:
                wait = MIN_INTERVAL_SECONDS - (self._clock() - self._last_call)
                if wait > 0:
                    self._sleep(wait)
            try:
                response = self.session.get(
                    f"{self.base_url}/search",
                    params=params,
                    headers={"User-Agent": self.user_agent, "Accept-Language": "en"},
                    timeout=self.timeout,
                )
            except (requests.Timeout, requests.ConnectionError):
                raise ProviderBusy("The backup map service did not respond. Please try again in a moment.")
            finally:
                self._last_call = self._clock()

        if response.status_code in (403, 429):
            raise ProviderBusy("The backup map service is busy right now. Please try again shortly.")
        if response.status_code != 200:
            raise ProviderBusy("The backup map service could not be reached. Please try again in a moment.")
        return response.json()

    @staticmethod
    def _label(item, fallback):
        address = item.get("address") or {}
        place = item.get("name") or next((address[key] for key in CITY_KEYS if address.get(key)), None)
        label = ", ".join(part for part in (place, address.get("state"), address.get("country")) if part)
        return label or item.get("display_name") or fallback
