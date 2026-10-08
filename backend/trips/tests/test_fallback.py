import pytest
import requests

from trips.exceptions import LocationNotFound, ProviderBusy, RoutingFailed
from trips.providers import FallbackGeocoder
from trips.providers.base import GeocodedLocation
from trips.providers.nominatim import MIN_INTERVAL_SECONDS, NominatimGeocoder

from .fakes import FakeResponse, FakeSession

PUNE = {
    "name": "Pune",
    "display_name": "Pune, Pune City Subdistrict, Pune, Maharashtra, 411001, India",
    "lat": "18.5213738",
    "lon": "73.8545071",
    "address": {"city": "Pune", "state": "Maharashtra", "country": "India"},
}


class FakeClock:
    """A clock the test moves forward by sleeping."""

    def __init__(self):
        self.now = 100.0
        self.slept = []

    def time(self):
        return self.now

    def sleep(self, seconds):
        self.slept.append(seconds)
        self.now += seconds


def nominatim(*responses):
    clock = FakeClock()
    session = FakeSession(*responses)
    geocoder = NominatimGeocoder("Test-Agent/1.0", session=session, sleep=clock.sleep, clock=clock.time)
    return geocoder, session, clock


def test_nominatim_returns_a_short_label_and_coordinates():
    geocoder, session, _ = nominatim(FakeResponse(200, [PUNE]))
    place = geocoder.geocode("Pune, Maharashtra", country="IN")

    assert (place.lat, place.lon) == (18.5213738, 73.8545071)
    assert place.label == "Pune, Maharashtra, India"
    method, url, kwargs = session.calls[0]
    assert url.endswith("/search")
    assert kwargs["params"]["countrycodes"] == "in"
    assert kwargs["params"]["limit"] == 1
    assert kwargs["headers"]["User-Agent"] == "Test-Agent/1.0"


def test_nominatim_without_a_country_does_not_restrict_the_search():
    geocoder, session, _ = nominatim(FakeResponse(200, [PUNE]))
    geocoder.geocode("Pune")
    assert "countrycodes" not in session.calls[0][2]["params"]


def test_nominatim_spaces_requests_at_least_a_second_apart():
    geocoder, _, clock = nominatim(FakeResponse(200, [PUNE]), FakeResponse(200, [PUNE]), FakeResponse(200, [PUNE]))
    for _ in range(3):
        geocoder.geocode("Pune")
    assert clock.slept == [pytest.approx(MIN_INTERVAL_SECONDS)] * 2  # the first call needs no wait


def test_nominatim_retries_with_place_and_region_when_the_full_address_finds_nothing():
    geocoder, session, _ = nominatim(FakeResponse(200, []), FakeResponse(200, [PUNE]))
    parts = {"place": "Pune", "area": "Haveli", "region": "Maharashtra", "postal": "999999"}

    place = geocoder.geocode("Pune, Haveli, Maharashtra, 999999", country="IN", parts=parts)

    assert place.label == "Pune, Maharashtra, India"
    assert session.calls[1][2]["params"]["q"] == "Pune, Maharashtra"


def test_nominatim_not_found():
    geocoder, _, _ = nominatim(FakeResponse(200, []))
    with pytest.raises(LocationNotFound):
        geocoder.geocode("Nowhereville", country="IN")


@pytest.mark.parametrize(
    "response",
    [requests.Timeout(), requests.ConnectionError(), FakeResponse(429, []), FakeResponse(403, []), FakeResponse(500, [])],
)
def test_nominatim_failures_are_busy_errors(response):
    geocoder, _, _ = nominatim(response)
    with pytest.raises(ProviderBusy):
        geocoder.geocode("Pune")


class Stub:
    def __init__(self, result=None, error=None):
        self.result, self.error, self.calls = result, error, 0

    def geocode(self, text, country=None, parts=None):
        self.calls += 1
        if self.error:
            raise self.error
        return self.result


def place(label):
    return GeocodedLocation(input="x", label=label, lat=1.0, lon=2.0)


def test_main_geocoder_is_used_when_it_works():
    main, backup = Stub(place("main")), Stub(place("backup"))
    assert FallbackGeocoder(main, backup).geocode("x").label == "main"
    assert backup.calls == 0


@pytest.mark.parametrize("error", [ProviderBusy("quota"), RoutingFailed("bad key")])
def test_backup_is_used_when_the_main_geocoder_cannot_answer(error):
    main, backup = Stub(error=error), Stub(place("backup"))
    assert FallbackGeocoder(main, backup).geocode("x").label == "backup"


def test_not_found_from_the_main_geocoder_is_final():
    main, backup = Stub(error=LocationNotFound("nope")), Stub(place("backup"))
    with pytest.raises(LocationNotFound):
        FallbackGeocoder(main, backup).geocode("x")
    assert backup.calls == 0


def test_main_geocoder_is_skipped_for_a_while_after_a_failure():
    now = [0.0]
    main, backup = Stub(error=ProviderBusy("quota")), Stub(place("backup"))
    geocoder = FallbackGeocoder(main, backup, clock=lambda: now[0], cool_down=300)

    geocoder.geocode("a")
    geocoder.geocode("b")
    assert main.calls == 1  # the second lookup went straight to the backup

    now[0] = 301
    geocoder.geocode("c")
    assert main.calls == 2  # cool-down over: the main geocoder is tried again


def test_errors_from_the_backup_reach_the_caller():
    main, backup = Stub(error=ProviderBusy("quota")), Stub(error=ProviderBusy("backup busy"))
    with pytest.raises(ProviderBusy) as error:
        FallbackGeocoder(main, backup).geocode("x")
    assert error.value.message == "backup busy"
