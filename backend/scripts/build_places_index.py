"""Build trips/data/us_places.csv from a GeoNames dump (cities5000.txt).

Usage:
    python scripts/build_places_index.py path/to/cities5000.txt

Data: GeoNames (https://www.geonames.org), licensed CC BY 4.0.
Download: https://download.geonames.org/export/dump/cities5000.zip
"""

import csv
import sys
from pathlib import Path

STATES = set(
    "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC "
    "ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split()
)

OUTPUT = Path(__file__).resolve().parent.parent / "trips" / "data" / "us_places.csv"


def main(source):
    rows = []
    with open(source, encoding="utf-8") as handle:
        for line in handle:
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 15 or fields[8] != "US" or fields[10] not in STATES:
                continue
            rows.append((fields[2], fields[10], float(fields[4]), float(fields[5]), int(fields[14] or 0)))

    rows.sort(key=lambda row: (row[1], row[0]))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["name", "state", "lat", "lon", "population"])
        writer.writerows(rows)
    print(f"wrote {len(rows)} places to {OUTPUT}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
