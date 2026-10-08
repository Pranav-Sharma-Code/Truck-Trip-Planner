"""Turns a trip request into a full plan: route, stops, daily logs, summary.

Geocoding and routing come in through the `geocoder` and `router` arguments so
the whole flow can be tested without the network.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from ..exceptions import PlannerError
from ..geo.geometry import RoutePath, simplify
from ..hos import constants as c
from ..hos.daily_logs import build_daily_logs
from ..hos.models import EventType, Leg
from ..hos.scheduler import plan_trip
from ..hos.validator import validate

LOCATION_FIELDS = ("current_location", "pickup_location", "dropoff_location")
NEAR_PLACE_MILES = 8  # beyond this a stop is described as "near City, ST"
GEOMETRY_TOLERANCE_MILES = 0.15
ANCHOR_SNAP_MILES = 0.25  # events this close to a trip location are placed at it

ASSUMPTIONS = [
    "Property-carrying driver on the 70-hour/8-day schedule, with no adverse driving conditions.",
    "The US federal hours-of-service rules (FMCSA) are applied to every trip, wherever it is.",
    "The driver starts the trip after at least 10 hours off duty, with a full fuel tank.",
    "Pickup and drop-off each take 1 hour (on duty, not driving).",
    "Fuel stops take 30 minutes and happen at least every 1,000 miles.",
    "Cycle hours used before the trip do not roll off during the trip.",
    "Drive times come from a truck routing profile and do not include traffic or weather.",
]


FUEL_STATION_NOTE = (
    "Fuel stops are placed at a real petrol station within about 5 miles of the route where one is found; "
    "the small detour is not added to the drive time."
)
FUEL_LOOKUP_WAIT_SECONDS = 10  # overall limit for finding stations; after that the plain fuel stops stay


def build_trip_plan(request, geocoder, router, places, now=None, fuel_finder=None):
    """`request` is the validated request data; returns a JSON-ready dict.

    `fuel_finder` (optional) names a real petrol station for each fuel stop; without one, or when it
    finds nothing, a fuel stop is just placed on the route.
    """
    locations = _geocode_all(request, geocoder)
    current, pickup, dropoff = (locations[field] for field in LOCATION_FIELDS)

    route = router.route([current.point, pickup.point, dropoff.point])
    to_pickup, to_dropoff = route.legs
    path = RoutePath(route.geometry, route.distance_miles)

    start = request.get("start_time") or now or datetime.now(timezone.utc)
    start = start.replace(second=0, microsecond=0)
    cycle_used = round(request["current_cycle_used_hours"] * 60)

    schedule = plan_trip(
        Leg("pickup", to_pickup.distance_miles, to_pickup.duration_minutes),
        Leg("drop-off", to_dropoff.distance_miles, to_dropoff.duration_minutes),
        start,
        cycle_used,
    )
    violations = validate(schedule.events, cycle_used)

    def describe(point):
        place, distance = places.locate(*point)
        if place is None:
            return f"{point[0]:.2f}, {point[1]:.2f}"
        return place.label if distance <= NEAR_PLACE_MILES else f"near {place.label}"

    # The three places the user typed keep the geocoder's name; the geocoder puts a city at its
    # geographic centre, which can be miles from the nearest town in the places list.
    anchors = [
        (0.0, current.point, _clean(current.label)),
        (to_pickup.distance_miles, pickup.point, _clean(pickup.label)),
        (route.distance_miles, dropoff.point, _clean(dropoff.label)),
    ]

    stations = _find_stations(schedule.events, path, fuel_finder)

    def resolve(event, mile):
        if event.id in stations:
            station = stations[event.id]
            point = (station.lat, station.lon)
            return point, f"{station.name}, {describe(point)}"
        if event.type is EventType.PICKUP:
            return pickup.point, _clean(pickup.label)
        if event.type is EventType.DROPOFF:
            return dropoff.point, _clean(dropoff.label)
        for anchor_mile, point, label in anchors:
            if abs(mile - anchor_mile) < ANCHOR_SNAP_MILES:
                return point, label
        point = path.point_at(mile)
        return point, describe(point)

    event_rows, labels = [], {}
    for event in schedule.events:
        begin, begin_label = resolve(event, event.start_mile)
        finish, finish_label = resolve(event, event.end_mile)
        labels[event.id] = {"start": begin_label, "end": finish_label}
        event_rows.append(_event_row(event, begin, finish, labels[event.id], stations.get(event.id)))

    daily_logs = build_daily_logs(schedule.events, schedule.cycle_used_start_minutes, labels)
    kinds = [event.type for event in schedule.events]
    driving_minutes = sum(e.duration_minutes for e in schedule.events if e.type is EventType.DRIVE)
    arrival = schedule.events[-1].end

    return {
        "locations": {
            field.removesuffix("_location"): {
                "input": request[field],
                "label": location.label,
                "lat": location.lat,
                "lon": location.lon,
            }
            for field, location in locations.items()
        },
        "route": {
            "distance_miles": round(route.distance_miles, 1),
            "driving_minutes": route.duration_minutes,
            "geometry": [
                [round(lat, 5), round(lon, 5)]
                for lat, lon in simplify(route.geometry, GEOMETRY_TOLERANCE_MILES)
            ],
            "legs": [
                {
                    "from": origin,
                    "to": target,
                    "distance_miles": round(leg.distance_miles, 1),
                    "duration_minutes": leg.duration_minutes,
                }
                for (origin, target), leg in zip((("current", "pickup"), ("pickup", "dropoff")), route.legs)
            ],
        },
        "events": event_rows,
        "daily_logs": daily_logs,
        "summary": {
            "total_miles": round(schedule.total_miles, 1),
            "driving_hours": _hours(driving_minutes),
            "trip_hours": _hours(int((arrival - start).total_seconds() // 60)),
            "start": start.isoformat(),
            "arrival": arrival.isoformat(),
            "cycle_used_start_hours": _hours(schedule.cycle_used_start_minutes),
            "cycle_used_end_hours": _hours(schedule.cycle_used_end_minutes),
            "cycle_available_end_hours": _hours(max(0, c.CYCLE_LIMIT - schedule.cycle_used_end_minutes)),
            "fuel_stops": kinds.count(EventType.FUEL),
            "breaks": kinds.count(EventType.BREAK),
            "rests": kinds.count(EventType.REST),
            "restarts": kinds.count(EventType.RESTART),
            "log_sheets": len(daily_logs),
        },
        "compliance": {
            "ok": not violations,
            "violations": [
                {"code": v.code, "message": v.message, "event_id": v.event_id} for v in violations
            ],
        },
        "warnings": schedule.warnings,
        "assumptions": ASSUMPTIONS + ([FUEL_STATION_NOTE] if stations else []),
    }


def _find_stations(events, path, finder):
    """{event id: FuelStation} for the fuel stops that have a real petrol station nearby.

    Looks up every fuel stop at once; a stop whose lookup fails or times out keeps its plain place on the route.
    """
    fuel_events = [event for event in events if event.type is EventType.FUEL]
    if finder is None or not fuel_events:
        return {}

    pool = ThreadPoolExecutor(max_workers=len(fuel_events))
    try:
        futures = {event.id: pool.submit(finder.nearest, *path.point_at(event.start_mile)) for event in fuel_events}
        stations = {}
        for event_id, future in futures.items():
            try:
                station = future.result(timeout=FUEL_LOOKUP_WAIT_SECONDS)
            except Exception:  # a slow or broken lookup must never fail the plan
                continue
            if station is not None:
                stations[event_id] = station
        return stations
    finally:
        pool.shutdown(wait=False, cancel_futures=True)


def _geocode_all(request, geocoder):
    with ThreadPoolExecutor(max_workers=len(LOCATION_FIELDS)) as pool:
        futures = {
            field: pool.submit(
                geocoder.geocode,
                request[field],
                request.get(field.replace("_location", "_country")),
                request.get(field.replace("_location", "_parts")),
            )
            for field in LOCATION_FIELDS
        }
    locations = {}
    for field, future in futures.items():
        try:
            locations[field] = future.result()
        except PlannerError as error:
            error.field = error.field or field
            raise
    return locations


def _clean(label):
    return label.removesuffix(", USA")


def _hours(minutes):
    return round(minutes / 60, 2)


def _place(point, label):
    return {"lat": round(point[0], 5), "lon": round(point[1], 5), "label": label}


def _event_row(event, begin, finish, label, station=None):
    return {
        "id": event.id,
        "type": event.type.value,
        "duty_status": event.duty_status.value,
        "start": event.start.isoformat(),
        "end": event.end.isoformat(),
        "duration_minutes": event.duration_minutes,
        "start_mile": round(event.start_mile, 1),
        "end_mile": round(event.end_mile, 1),
        "location": _place(begin, label["start"]),
        "end_location": _place(finish, label["end"]),
        "station": {"name": station.name, "lat": round(station.lat, 5), "lon": round(station.lon, 5)} if station else None,
        "reason": event.reason,
        "rule": event.rule,
        "clocks_after": event.clocks_after,
    }
