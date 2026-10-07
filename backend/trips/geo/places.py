import csv
from collections import defaultdict
from dataclasses import dataclass
from functools import lru_cache
from math import cos, floor, radians
from pathlib import Path

from .geometry import haversine_miles

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "us_places.csv"
MAX_RING = 12  # grid cells (about 1 degree each) to search before giving up


@dataclass(frozen=True)
class Place:
    name: str
    state: str
    lat: float
    lon: float

    @property
    def label(self):
        return f"{self.name}, {self.state}"


class PlaceIndex:
    """Nearest-city lookup over a 1-degree grid of US places."""

    def __init__(self, places):
        self.places = list(places)
        self._grid = defaultdict(list)
        for place in self.places:
            self._grid[(floor(place.lat), floor(place.lon))].append(place)

    @classmethod
    def from_csv(cls, path=DATA_FILE):
        with open(path, newline="", encoding="utf-8") as handle:
            return cls(
                Place(row["name"], row["state"], float(row["lat"]), float(row["lon"]))
                for row in csv.DictReader(handle)
            )

    def nearest(self, lat, lon):
        """Return (place, distance_miles), or (None, None) if nothing is close."""
        row, col = floor(lat), floor(lon)
        # A cell is at least this wide in miles, which tells us when a ring can't beat the best so far.
        cell_miles = max(1.0, 69.0 * cos(radians(min(abs(lat), 80))))
        best, best_distance = None, None

        for ring in range(MAX_RING + 1):
            if best is not None and (ring - 1) * cell_miles >= best_distance:
                break
            for d_row in range(-ring, ring + 1):
                for d_col in range(-ring, ring + 1):
                    if max(abs(d_row), abs(d_col)) != ring:
                        continue
                    for place in self._grid.get((row + d_row, col + d_col), ()):
                        distance = haversine_miles((lat, lon), (place.lat, place.lon))
                        if best is None or distance < best_distance:
                            best, best_distance = place, distance
        return best, best_distance


@lru_cache(maxsize=1)
def get_place_index():
    return PlaceIndex.from_csv()
