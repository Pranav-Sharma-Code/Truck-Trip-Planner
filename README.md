# HOS Trip Planner

A full-stack trip planner for property-carrying truck drivers on the **70-hour / 8-day** schedule.

You enter four things: **current location, pickup location, drop-off location, and cycle hours already used.**
The app returns a route with fuel and rest stops, and filled-in **daily log sheets** (one per day, so long trips
get several).

Stack: **Django + Django REST Framework** (backend) and **React + Vite** (frontend).

---

## 1. Project status

| Part | Status |
|---|---|
| Backend skeleton, `/api/health/` | Done |
| HOS engine: constants, clock, scheduler, validator, daily logs; 125 tests in total | Done |
| Daily log builder (split events into 24-hour sheets) | Done |
| Geometry helpers and "City, ST" lookup for log remarks | Done |
| Geocoding and routing client (OpenRouteService) | Done |
| Trip planning API endpoint (`POST /api/trips/plan/`) | Done |
| React frontend: form, map, timeline | Planned |
| Drawn ELD log sheets (SVG) | Planned |
| Deployment (Vercel + Render) | Planned |

This README is updated as each part lands. The sections below mark what exists today and what does not.

---

## 2. The big idea (explain this first)

The hard part of this project is **not** the screens. It is deciding *when the driver must stop*, legally.

```
 inputs ──► geocode + route ──► HOS scheduler ──► validator ──► daily logs ──► React UI
                                  (the core)      (double-check)  (24h sheets)   (map, timeline, drawn logs)
```

1. Turn the three place names into coordinates and get real driving distance/time (routing service).
2. Feed those two legs (current → pickup, pickup → drop-off) to a **scheduler** that walks through the trip and
   inserts every stop the rules require.
3. A separate **validator** re-checks the finished plan against the rules.
4. Cut the plan into calendar days and draw each day as a log sheet.

The scheduler is plain Python with no Django and no network calls, so it can be tested on its own. That is why it
has 125 unit tests and the web layer stays thin.

---

## 3. The rules being enforced

Source: FMCSA *Interstate Truck Driver's Guide to Hours of Service* (April 2022), plus the assessment's own
assumptions. All numbers live in one file: `backend/trips/hos/constants.py`.

| Rule | Limit | What the code does |
|---|---|---|
| 11-hour driving limit | 11 h of driving after a 10-hour rest | Stops driving, inserts a 10-hour rest |
| 14-hour window | Driving not allowed 14 h after starting work | Same 10-hour rest; on-duty work is still allowed after hour 14 |
| 30-minute break | After 8 cumulative hours of driving | Inserts a 30-minute break |
| 70-hour / 8-day cycle | 70 h on duty in a rolling 8 days | When used up, inserts a 34-hour restart |
| 34-hour restart | 34 h off duty resets the cycle to zero | Used only when the cycle runs out |
| Pickup / drop-off | 1 h each, on duty (assessment) | Always scheduled, counted toward the cycle |
| Fuel | At least once every 1,000 miles (assessment) | Inserts a fuel stop before mile 1,000 |

**Four duty statuses** (the four rows of the log sheet): Off Duty, Sleeper Berth, Driving, On Duty (not driving).
Fuel, pickup and drop-off are *On Duty (not driving)*, so they use up cycle hours but are not driving time.

**Assumptions (not in the sources, so they are stated openly):**
- A fuel stop takes 30 minutes. The assessment does not say.
- The driver starts the trip fully rested (fresh 11- and 14-hour clocks).
- Hours already used in the cycle never "roll off" during the trip. This is the cautious choice.
- Not modelled: adverse conditions, short-haul exceptions, split sleeper, personal conveyance, inspections.
- The 8-hour break rule counts **cumulative driving** (guide page 10), not "8 hours since the last break"
  (the wording on page 6). The two pages differ slightly, so this choice is flagged here.

---

## 4. Folder structure

What exists today is marked with a check. The rest is the plan.

```
evm/
├─ README.md                  ✔
├─ .gitignore                 ✔  (keeps secrets and the assessment files out of git)
├─ backend/
│  ├─ manage.py               ✔
│  ├─ requirements.txt        ✔
│  ├─ pytest.ini              ✔
│  ├─ .env.example            ✔  (copy to .env)
│  ├─ config/                 ✔  Django settings, urls, wsgi
│  └─ trips/
│     ├─ urls.py, views.py    ✔  /api/health/ and /api/trips/plan/
│     ├─ serializers.py       ✔  request validation
│     ├─ api_errors.py        ✔  every error becomes {code, message, field}
│     ├─ hos/                 ✔  THE CORE
│     │  ├─ constants.py      ✔  every HOS number in one place
│     │  ├─ models.py         ✔  DutyStatus, EventType, Leg, Event, TripSchedule, Violation
│     │  ├─ clock.py          ✔  running counters (driving, window, break, cycle, fuel)
│     │  ├─ scheduler.py      ✔  plan_trip(): builds the list of events
│     │  ├─ validator.py      ✔  re-checks a finished plan
│     │  └─ daily_logs.py     ✔  splits events into one 24-hour sheet per day
│     ├─ geo/                 ✔  geometry.py (distance, point at mile N, simplify), places.py (nearest City, ST)
│     ├─ data/us_places.csv   ✔  7,557 US places from GeoNames (see credits)
│     ├─ scripts/ (in backend/) ✔  build_places_index.py rebuilds the CSV
│     ├─ providers/           ✔  base.py (types), ors.py (OpenRouteService client)
│     ├─ exceptions.py        ✔  clean, user-facing planner errors
│     ├─ services/planner.py  ✔  geocode -> route -> schedule -> validate -> logs -> response
│     └─ tests/               ✔  test_clock, test_scheduler, test_validator, test_daily_logs, test_geometry, test_places, test_ors, test_api, test_health
└─ frontend/                     planned  React + Vite
```

---

## 5. How the HOS engine works (the part to be able to explain)

### 5.1 The clock (`hos/clock.py`)

`HosClock` is a set of counters. Every time the driver does something, `apply(status, minutes)` updates them:

| Counter | Meaning | Resets when |
|---|---|---|
| `driving_in_shift` | driving minutes since the last 10 h rest | 10 h off duty or sleeper |
| `shift_start` | when the 14-hour window opened | 10 h off duty or sleeper |
| `driving_since_break` | driving minutes since the last 30-min break | 30 min of non-driving in a row |
| `cycle_used` | on-duty + driving minutes in the cycle | 34 h off duty or sleeper |
| `miles_since_fuel` | miles since the last fuel stop | a fuel stop |

Two "streak" counters make the resets correct. One counts consecutive **non-driving** time (any kind), the other
counts consecutive **off-duty/sleeper** time. This is why 15 minutes on duty plus 15 minutes off duty correctly
counts as a 30-minute break, exactly as the FMCSA guide allows, but two short stops separated by driving do not.

Helper methods answer "how much is left?": `driving_left()`, `window_left()`, `until_break()`, `cycle_left()`,
`fuel_left_miles()`.

All time is stored as **whole minutes**, so there is no floating-point drift.

### 5.2 The scheduler (`hos/scheduler.py`)

`plan_trip(to_pickup, to_dropoff, start, cycle_used_minutes)` runs this loop for each driving leg:

```
while there is still distance to drive on this leg:
    if cycle is used up:                    insert 34-hour restart
    elif 11h used up or 14h window over:    insert 10-hour rest
    elif 1,000 miles since fuel:            insert 30-minute fuel stop
    elif 8h driven since last break:        insert 30-minute break
    else:                                   drive as far as the TIGHTEST limit allows
```

The order matters: a bigger reset also satisfies the smaller ones, so it is checked first.

"The tightest limit" means the driving chunk is the smallest of: time left on the leg, 11-hour time left, 14-hour
window left, time until the next break, cycle time left, and minutes until the next fuel stop. So each drive block
ends exactly when some rule says it must.

Between the two legs the scheduler inserts the 1-hour pickup, and after the second leg the 1-hour drop-off.

Every event it creates records a **reason** (plain English) and a **rule** (for example `395.3(a)(3)(ii)`), plus a
snapshot of the counters afterwards. That is what makes the output auditable.

### 5.3 A worked example

Pickup leg: 180 mi / 3 h. Drop-off leg: 900 mi / 14 h. Cycle used: 20 h. Start 06:00.

| When | What | Why |
|---|---|---|
| Day 1 06:00–09:00 | Drive 180 mi | to pickup |
| 09:00–10:00 | Pickup (on duty) | assessment: 1 hour |
| 10:00–18:00 | Drive 8 h | stops at 11 h of total driving |
| 18:00–04:00 | 10-hour rest (sleeper) | 11-hour driving limit |
| Day 2 04:00–08:45 | Drive 4 h 45 m | until the 1,000-mile fuel point |
| 08:45–09:15 | Fuel (on duty) | 1,000-mile rule |
| 09:15–10:30 | Drive 1 h 15 m | rest of the leg |
| 10:30–11:30 | Drop-off (on duty) | assessment: 1 hour |

Cycle used goes 20 h → 39.5 h. This exact scenario is a unit test
(`test_worked_example_from_the_plan`).

### 5.4 The validator (`hos/validator.py`)

The validator takes a finished list of events and reports every broken rule. It deliberately does **not** reuse
`HosClock`. Instead, for each driving block it looks *backwards* through the events to find the last reset, then
adds things up. A bug in the scheduler's running counters therefore cannot hide itself.

It checks: overlaps and gaps, 11-hour limit, 14-hour window, 8-hour break, 70-hour cycle, 1,000-mile fuel interval.

### 5.5 Daily logs (`hos/daily_logs.py`)

`build_daily_logs(events, cycle_used_start_minutes, labels)` turns the event list into one sheet per calendar day:

- Events are clipped at midnight, so a rest or a drive that crosses midnight appears on both days.
- Time before the first event and after the last is logged as off duty, so every sheet covers exactly 1,440 minutes.
  The code raises an error if a sheet ever fails to add up to 24 hours.
- Each sheet has: ordered duty-status segments, totals per status, miles driven that day (split by time when a drive
  crosses midnight), remarks at every status change, and a recap (on-duty time today, cycle used at midnight, cycle
  hours still available, whether a 34-hour restart finished that day).
- Remarks need place names. The planner will pass them in as `labels`; until then they are `None`.

### 5.6 Geo helpers (`trips/geo/`)

Two small jobs, both needed to put names on the map and on the log remarks:

- **`RoutePath.point_at(mile)`** answers "where is the truck N miles into the route?". The scheduler only knows
  mileage, so this turns a stop at mile 640 into a latitude/longitude. The routing service's distance and the
  polyline's own length differ slightly, so mileage is scaled to land exactly on the last point.
- **`PlaceIndex.nearest(lat, lon)`** finds the closest US city, so each stop can be written as "City, ST" (the
  FMCSA guide requires this for every duty status change). It reads a local file, so there are no API calls, no
  rate limits, and results are repeatable. Places sit on a 1-degree grid and the search widens ring by ring until
  no closer place is possible. A test checks it against a brute-force search of every place.
- **`simplify()`** thins the route line (Douglas-Peucker) so the browser is not sent tens of thousands of points.

### 5.7 Routing client (`trips/providers/ors.py`)

Talks to [OpenRouteService](https://openrouteservice.org) (free API key, set as `ORS_API_KEY`):

- **Geocoding** turns "Dallas, TX" into coordinates, restricted to the US. Results are cached in memory.
- **Routing** uses the heavy-goods-vehicle (truck) profile and returns one leg per pair of stops (distance in miles,
  duration in whole minutes) plus the route line. If two stops are the same place, that leg is zero-length and
  no extra request is made.
- **Errors** are turned into clear messages: place not found (422), no drivable route (422), trip too long for the
  service (422), service busy or timed out (503), bad key or other failures (502). The API key is never included
  in an error message.
- The scheduler and API only depend on two small interfaces (`Geocoder`, `Router` in `providers/base.py`), so tests
  use fakes and need neither the network nor a key.

Known limits of the provider: the free tier caps a single route at about 6,000 km (roughly 3,700 miles) and has
a daily request quota. Its truck profile assumes conservative speeds (a drive of about 190 miles came back as
5 hours), so planned trips can run longer than a real driver's. The schedule is only as accurate as these times.

### 5.8 The API (`trips/views.py`, `trips/services/planner.py`)

`POST /api/trips/plan/`

```json
{
  "current_location": "Los Angeles, CA",
  "pickup_location": "Phoenix, AZ",
  "dropoff_location": "Chicago, IL",
  "current_cycle_used_hours": 20,
  "start_time": "2026-10-12T06:00:00-05:00"
}
```

`start_time` is optional but must include a UTC offset. Daily logs follow that offset (the "home terminal time"
the FMCSA guide asks for). Without it the server uses the current time in UTC.

The response has these parts:

| Key | Contents |
|---|---|
| `locations` | the three places as resolved: label, latitude, longitude |
| `route` | total distance and drive time, per-leg figures, the route line (thinned for the browser) |
| `events` | every stop in order: type, duty status, times, mileage, location, **reason**, **rule**, counters afterwards |
| `daily_logs` | one entry per day: segments, totals, miles, remarks, recap (see 5.5) |
| `summary` | miles, driving hours, trip hours, arrival, cycle used before and after, counts of fuel/breaks/rests/restarts, number of sheets |
| `compliance` | `ok` plus any violations the validator found (should always be empty) |
| `warnings` | for example `restart_scheduled` when the cycle runs out |
| `assumptions` | the assumptions behind the plan, in plain text |

Errors always look like `{"code", "message", "field"?}`:

| Status | `code` | When |
|---|---|---|
| 400 | `validation_error` | bad input; `field` names it (cycle outside 0 to 70, blank place, start time without offset) |
| 422 | `location_not_found` | a place could not be found; `field` says which one |
| 422 | `route_not_found` | no drivable route, or longer than the routing service allows |
| 429 | `rate_limited` | more than 30 requests a minute from one address |
| 502 / 503 | `routing_failed` / `provider_busy` | routing service problem, timeout or rate limit |

Stops at the three places you typed use the name the geocoder returned ("Phoenix, AZ"). Stops along the way
(breaks, rests, fuel) are described by the nearest sizeable place from the local list, for example
"near Buckeye, AZ".

Try it with the server running:

```
curl -X POST http://localhost:8000/api/trips/plan/ -H "Content-Type: application/json" ^
  -d "{\"current_location\":\"Dallas, TX\",\"pickup_location\":\"Fort Worth, TX\",\"dropoff_location\":\"Austin, TX\",\"current_cycle_used_hours\":10}"
```

### 5.9 Tests

```
cd backend
.venv\Scripts\python -m pytest -q        # Windows
```

The tests cover: break at exactly 8 hours, rest at exactly 11 hours, the 14-hour window, cycle near 70
(69.5 h → restart mid-leg, 70 h → restart before leaving), fuel at 999 / 1,000 / 1,001 miles, pickup and drop-off
accounting, a multi-day trip, bad input, and 300 random trips that must all pass the validator.

---

## Credits

Place names and coordinates come from [GeoNames](https://www.geonames.org), licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Map data will come from OpenStreetMap contributors.

---

## 6. Run it locally (backend)

Needs Python 3.12 or newer.

```
cd backend
python -m venv .venv
.venv\Scripts\activate                  # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env                  # macOS/Linux: cp .env.example .env
python manage.py runserver
```

Check it: open `http://localhost:8000/api/health/`. It should return `{"status": "ok"}`.

To plan real trips, put your OpenRouteService key in `backend/.env` as `ORS_API_KEY` (free at openrouteservice.org).
The tests do not need it.

### Environment variables (backend)

| Variable | Purpose |
|---|---|
| `DJANGO_SECRET_KEY` | required when `DJANGO_DEBUG` is not `true` |
| `DJANGO_DEBUG` | `true` for local development |
| `DJANGO_ALLOWED_HOSTS` | comma-separated hosts |
| `CORS_ALLOWED_ORIGINS` | frontend origin(s) allowed to call the API |
| `ORS_API_KEY` | OpenRouteService key (used once routing is added) |

---

## 7. What is planned next

1. **Frontend** — input form, map with stop markers, timeline, summary.
2. **Log sheets** — SVG drawing of the 24-hour grid, remarks and totals, printable.
3. **Deployment** — frontend on Vercel, backend on Render.

---

## 8. How to explain this project (for a walkthrough or interview)

**30-second version**
> It's a trip planner for truck drivers. You give it where the truck is, where to pick up, where to deliver and
> how many cycle hours are already used. It works out the real route and then schedules every legal stop — breaks,
> 10-hour rests, fuel, a 34-hour restart if needed — and draws the daily log sheets a driver would fill in.
> The interesting part is a scheduler that follows the federal hours-of-service rules.

**Why is the scheduler separate from Django?**
Because the rules are the risky part. As plain Python it needs no database or network, so I can test exact edge
cases (exactly 8 hours, exactly 11 hours, cycle at 69.5) in milliseconds.

**How do you know the schedule is legal?**
A second module, the validator, re-checks it using a different method (looking backwards instead of keeping running
counters). Tests also run 300 random trips through it.

**Why minutes, not hours?**
Whole minutes avoid floating-point drift when you add many small durations.

**What did you assume?**
Fuel stop of 30 minutes; the driver starts rested; cycle hours don't roll off mid-trip; no exceptions like
adverse driving or short-haul. These are listed in section 3 on purpose.

**What would you improve with more time?**
Real traffic and weather, rolling-off of old cycle days, split-sleeper rest, time-zone changes, and choosing fuel
stops at real truck stops rather than at the point where the limit is reached.

**Be honest about status.** Anything marked "Planned" in section 1 is not built yet. Only describe what is in the
code.
