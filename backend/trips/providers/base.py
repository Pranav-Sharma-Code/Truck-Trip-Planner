from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class GeocodedLocation:
    input: str
    label: str
    lat: float
    lon: float

    @property
    def point(self):
        return (self.lat, self.lon)


@dataclass(frozen=True)
class RouteLeg:
    distance_miles: float
    duration_minutes: int


@dataclass(frozen=True)
class RouteResult:
    legs: list
    geometry: list  # [(lat, lon), ...]

    @property
    def distance_miles(self):
        return sum(leg.distance_miles for leg in self.legs)

    @property
    def duration_minutes(self):
        return sum(leg.duration_minutes for leg in self.legs)


class Geocoder(Protocol):
    def geocode(self, text) -> GeocodedLocation: ...


class Router(Protocol):
    def route(self, points) -> RouteResult:
        """Route through (lat, lon) points in order; one leg per consecutive pair."""
