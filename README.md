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
| HOS engine: clock, scheduler, validator, daily logs | Done, with unit tests |
| Geocoding and truck routing (OpenRouteService), "City, ST" labels | Done |
| `POST /api/trips/plan/` with validation and clean errors | Done |
| Trip form, route map with stop markers, summary cards, timeline | Done |
| Drawn daily log sheets (SVG), print or save as PDF | Done |
| Address input that adapts to the country (state, district, postal code) | Done |
| Light, dark and system theme toggle | Done |
| Fuel stops named at a real petrol station (OpenStreetMap, best effort) | Done |
| HOS audit view (counters after every event, rule check) | Done |
| Deployment configuration (Render blueprint, Vercel settings, production settings) | Done |
| **Hosted live version** | **Not done.** Needs your Render and Vercel accounts; steps are in section 7 |
| Loom walkthrough | Script is in `docs/loom-script.md`; recording is up to you |

Tests: **206 backend tests** (`pytest`) and **73 frontend tests** (`npm test`). See section 8 for the assessment
checklist and section 9 for known gaps.

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
has 206 unit tests and the web layer stays thin.

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


```
evm/
├─ README.md
├─ render.yaml                Render blueprint for the API
├─ docs/loom-script.md        walkthrough script
├─ .gitignore                 keeps secrets and the assessment files out of git
├─ backend/
│  ├─ manage.py               ✔
│  ├─ requirements.txt        runtime dependencies
│  ├─ requirements-dev.txt    adds pytest
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
│     ├─ data/places.csv      ✔  69,772 places worldwide from GeoNames (see credits)
│     ├─ scripts/ (in backend/) ✔  build_places_index.py rebuilds the CSV
│     ├─ providers/           ✔  base.py (types), ors.py (OpenRouteService), nominatim.py (backup geocoder)
│     ├─ exceptions.py        ✔  clean, user-facing planner errors
│     ├─ services/planner.py  ✔  geocode -> route -> schedule -> validate -> logs -> response
│     └─ tests/               ✔  test_clock, test_scheduler, test_validator, test_daily_logs, test_geometry, test_places, test_ors, test_api, test_health
└─ frontend/                  React + Vite (JavaScript), Tailwind CSS, Leaflet
   ├─ vercel.json, .env.example
   └─ src/
      ├─ api/                 client.js (fetch + clean errors), types.js (JSDoc typedefs)
      ├─ hooks/               useApiStatus, usePlanTrip, useSlow, useLogDetails, usePrinting, useTheme
      ├─ lib/                 format, validation, startTime, eventTypes, tripView, dutyStatus, logGeometry,
      │                      countries, regions, locations (country-aware addresses), theme
      └─ components/
         ├─ ui/               Card, Button, Badge, Alert, Spinner, Tabs
         ├─ layout/           Header, ThemeToggle
         ├─ trip-form/        TripForm, LocationField, CountrySelect, CycleField, ExampleTrips
         ├─ results/          TripResults (tabs, links map and timeline)
         ├─ summary/          TripSummary
         ├─ map/              RouteMap, StopMarker, MapLegend
         ├─ timeline/         Timeline, TimelineItem
         ├─ logs/             LogSheet (+ Header, Grid, Remarks, Footer), LogSheetList, LogDetailsForm
         └─ audit/            AuditPanel
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
- **`PlaceIndex.nearest(lat, lon)`** finds the closest city, so each stop can be written as "City, ST" (the
  FMCSA guide requires a place name for every duty status change). US places show the state ("Dallas, TX"); places
  elsewhere show the country code ("Pune, IN"). It reads a local file of about 70,000 cities, so there are no API
  calls, no rate limits, and results are repeatable (loads in under a second, about 25 MB). Places sit on a 1-degree
  grid and the search widens ring by ring until no closer place is possible. A test checks it against a brute-force
  search of every place. `locate()` prefers the biggest city within a few miles, so downtown Chicago is "Chicago",
  not "Chicago Loop".
- **`simplify()`** thins the route line (Douglas-Peucker) so the browser is not sent tens of thousands of points.

### 5.7 Routing client (`trips/providers/ors.py`)

Talks to [OpenRouteService](https://openrouteservice.org) (free API key, set as `ORS_API_KEY`):

- **Geocoding** turns a place name such as "Dallas, TX" or "Pune, India" into coordinates. Any country works.
  Results are cached in memory.
- **Routing** uses the heavy-goods-vehicle (truck) profile and returns one leg per pair of stops (distance in miles,
  duration in whole minutes) plus the route line. If two stops are the same place, that leg is zero-length and
  no extra request is made.
- **Errors** are turned into clear messages: place not found (422), no drivable route (422), trip too long for the
  service (422), service busy or timed out (503), bad key or other failures (502). The API key is never included
  in an error message.
- The scheduler and API only depend on two small interfaces (`Geocoder`, `Router` in `providers/base.py`), so tests
  use fakes and need neither the network nor a key.

**Backup geocoder.** The free OpenRouteService key has a daily limit (about 1,000 searches and 2,000 routes). When it
runs out, or the service is down, place searches fall back to OpenStreetMap's Nominatim, which needs no key
(`providers/nominatim.py`). It is slower (requests are spaced a second apart, as its usage policy asks) but keeps the
app working. After a failure the main service is skipped for five minutes so each lookup does not wait on a failing
request. Routing has no backup, so if the routing quota runs out the app shows "The map service has reached its daily
limit". One shared client serves all requests, so repeat places are answered from memory without using quota. Set
`GEOCODER_FALLBACK=false` to turn the backup off, and `GEOCODER_USER_AGENT` to identify your deployment to Nominatim.

**Petrol stations.** A fuel stop is placed where the 1,000-mile limit is reached. If a petrol station is found within
about 5 miles of that point, the stop is moved to it and takes its name (for example "Bharath Petrol, near Kamareddi, IN"),
on the map, in the timeline and in the log remarks. Stations come from OpenStreetMap through the Overpass API
(`providers/overpass.py`, no key needed). This is best effort: the public Overpass servers are shared and sometimes slow
or busy, so three mirrors are tried in turn, each for a few seconds, and if none answer the stop keeps its plain place on
the route and the plan is unchanged. After a failure the lookup pauses for five minutes so plans are not slowed each time.
The stop is only moved in name and place; the small detour is not added to the drive time. Set `FUEL_STATIONS=false` to
turn it off, and `OVERPASS_URLS` (comma-separated) to use your own servers.

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

`start_time` is optional but must include a UTC offset. Also optional, per place: `current_country`,
`pickup_country`, `dropoff_country` (two-letter ISO codes such as `IN`, which limit the search to that country) and
`current_parts`, `pickup_parts`, `dropoff_parts` (`{place, area, region, postal}`, used for the fall-back search).
`start_time` must include a UTC offset. Daily logs follow that offset (the "home terminal time"
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
| 422 | `location_not_found` | a place could not be found anywhere in the world; `field` says which one |
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

### 5.9 The drawn log sheets (`frontend/src/components/logs/`)

Each day from `daily_logs` is drawn as an SVG that follows the FMCSA "Driver's Daily Log" layout:

- **Header**: date (month / day / year), from and to, total miles driving today, carrier, main office, home terminal,
  vehicle numbers. The carrier, vehicle, shipment and driver name are typed in the "Sheet details" box and remembered
  in the browser (local storage only; they never go to the server).
- **Graph grid**: 24 hours across (midnight to midnight, 30 px per hour) and four rows: Off Duty, Sleeper Berth,
  Driving, On Duty (not driving). Ticks every 15 minutes. The duty line is drawn exactly as on paper: a horizontal
  stroke per segment at the right times, joined by vertical strokes at each change of status.
- **Total hours column**: hours per status as H:MM, and the sum, which always reads 24:00. H:MM is used so the
  column adds up exactly, with no rounding.
- **Remarks**: a numbered marker under the grid at every status change and a list with the time, the "City, ST" and
  what happened. Markers that would overlap share a second level so every number stays readable.
- **Recap**: on-duty hours today, hours used in the cycle, hours available tomorrow, and a note when a 34-hour
  restart finished that day. "Last 5 days" is left as a dash because the app does not track it.
- **Signature line** with the driver's name if you entered it.

The sheet is always black on white ("paper"), in light or dark mode. All positions come from plain functions in
`lib/logGeometry.js` (minute to x, row to y, duty line, ticks), which are unit tested. "Print or save as PDF" prints
every day's sheet on its own letter-size page; only the visible day is drawn on screen to keep typing fast, and the
rest are drawn just before printing.

### 5.10 Tests

```
cd backend
.venv\Scripts\python -m pytest -q        # Windows
```

The tests cover: break at exactly 8 hours, rest at exactly 11 hours, the 14-hour window, cycle near 70
(69.5 h → restart mid-leg, 70 h → restart before leaving), fuel at 999 / 1,000 / 1,001 miles, pickup and drop-off
accounting, a multi-day trip, bad input, and 300 random trips that must all pass the validator.

---

## Run the frontend

Needs Node 20 or newer, and the backend running on port 8000.

```
cd frontend
npm install
copy .env.example .env        # macOS/Linux: cp .env.example .env
npm run dev                   # http://localhost:5173
npm test                      # unit tests for formatting, validation and start-time helpers
npm run build                 # production build into dist/
```

`VITE_API_BASE_URL` in `frontend/.env` points at the API (default `http://localhost:8000`).
Map tiles come from OpenStreetMap's public tile server (fine for a demo; a busy site would need its own tile
provider). OpenStreetMap has no dark style, so in dark mode the tiles are inverted with a CSS filter. Scroll-wheel
zoom turns on after you click the map, so scrolling the page over the map does not zoom it.

**Theme.** The header has a Light / Dark / System switch. System follows the device and changes with it. The choice
is remembered in this browser, and a small script in `index.html` applies it before the first paint so there is no
flash of the wrong colours. Colours are tokens in `src/index.css`; the theme is just a `data-theme` attribute on the
page.

**Addresses that follow the country.** Pick a country at the top of the form (or leave "Anywhere"). Under each place,
"Add state, district & PIN code" opens extra fields whose names, lists and rules change with the country:

| Country | Region | Area | Postal code |
|---|---|---|---|
| India | State / UT (all 36 as a list) | District | PIN code, 6 digits |
| United States | State (list) | County | ZIP code, 5 or 5+4 digits |
| Canada | Province / territory (list) | Municipality | Postal code, like M5V 2T6 |
| United Kingdom | Nation (list) | County | Postcode |
| Australia | State / territory (list) | Suburb / local area | Postcode, 4 digits |
| Germany, Mexico | State (list) | District / municipality | 5 digits |
| United Arab Emirates | Emirate (list) | Area / community | none: the field is hidden |
| Any other country | free text | District / county | free text, no rule |

The country list (about 250) comes from the browser, so names are never out of date. Each place can also have its
own country, which is how a trip across a border works (set the trip to "Anywhere", then choose a country per
place). Changing a country clears that place's state, district and postal code, so nothing stale is left behind.
Postal codes are checked as you type; the other parts are free text or a list.

What is sent to the API: the place as one search text (for example `Pune, Pune, Maharashtra, 411001`), an optional
country code per place, and the address parts. A free-text geocoder can collapse a long address to just the state,
so the server tries the most specific search first and falls back to looser ones (dropping postal code, then
district) when a result is only a state or country. If the last search still gives a state or country, that is used
as it is.

The form checks input as you type (a place or postal code is required, postal codes follow the country, cycle hours
between 0 and 70, valid start time) and the API checks it again. If the server rejects a place, the message appears
under that field until you edit it. The start time defaults to now, rounded up to a quarter hour, and is sent with
your local UTC offset. Four example trips (three in the US, one in India) fill the form in one click.

Design notes: colours are tokens in `src/index.css`, so light and dark share the same classes. Each duty status
has one colour used on the map, timeline and log sheets. Trip times are shown in the trip's own UTC offset
(read from the timestamp, not converted to the viewer's timezone), because that is how a driver's log is kept.

---

## Credits

Place names and coordinates (about 70,000 cities worldwide) come from [GeoNames](https://www.geonames.org), licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Map data and tiles are from [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.

---

## 6. Run it locally (backend)

Needs Python 3.12 or newer.

```
cd backend
python -m venv .venv
.venv\Scripts\activate                  # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements-dev.txt        # runtime + pytest
copy .env.example .env                  # macOS/Linux: cp .env.example .env
python manage.py runserver
python -m pytest -q                     # run the 206 backend tests
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
| `ORS_API_KEY` | OpenRouteService key |
| `NUM_PROXIES` | production: proxies in front of the app (1 on Render), so rate limits are per visitor |
| `SECURE_SSL_REDIRECT` | production: redirect http to https (default on; `/api/health/` is exempt) |
| `LOG_LEVEL` | optional, default `INFO` |
| `FUEL_STATIONS` | `true` (default) to name fuel stops at real petrol stations; `false` turns the lookup off |
| `OVERPASS_URLS` | optional comma-separated Overpass servers, tried in order (three public mirrors by default) |
| `GEOCODER_FALLBACK` | `true` (default) to use Nominatim when OpenRouteService cannot geocode |
| `GEOCODER_USER_AGENT` | identifies the app to Nominatim; has a sensible default |

Frontend: `VITE_API_BASE_URL` (the API's address).

---

## 7. Deployment

The API goes on **Render** and the React app on **Vercel**. Do the API first.

**API on Render** (uses `render.yaml`)

1. In Render choose New, then Blueprint, and select this GitHub repo. It creates `hos-trip-planner-api` from
   `render.yaml` (root `backend`, gunicorn, health check `/api/health/`, a generated `DJANGO_SECRET_KEY`).
2. When asked, enter `ORS_API_KEY`. For `CORS_ALLOWED_ORIGINS` put a placeholder for now.
3. When it is live, open `https://<your-service>.onrender.com/api/health/`; it should say `{"status":"ok"}`.

**App on Vercel**

1. New Project, import the repo, set **Root Directory** to `frontend` (Vite is detected automatically).
2. Add the environment variable `VITE_API_BASE_URL` = the Render URL (no trailing slash). Deploy.
3. Go back to Render and set `CORS_ALLOWED_ORIGINS` to the Vercel URL (comma-separate more than one). The service
   restarts and the app can now call the API.

**Smoke test** on the live URLs: run the three example trips, open each tab, print a sheet.

Things to know:

- Render's free service sleeps after about 15 minutes idle; the first request can take up to a minute. The app
  pings `/api/health/` when the page opens and says "Waking up the server" while it waits. Open the live site yourself
  shortly before a demo or a grader tests it.
- **Render free hours.** Render's free plan gives 750 instance hours per month for the whole workspace, and a free web
  service only uses hours while it is running (it sleeps after 15 minutes without traffic). One service cannot use more
  than about 744 hours in a month, so it will not run out on its own; if the 750 hours are ever used up (several services
  in one workspace), Render suspends them until the next month. Check Usage and Billing in the Render dashboard.
- **OpenRouteService quotas** (free plan): 1,000 searches and 2,000 routes a day. Usage per key is on the OpenRouteService
  dashboard. Use a separate key for the hosted app, so testing on your computer cannot use up the live site's quota.
- OpenRouteService's free plan has a daily request limit (each plan uses one routing call and up to three
  geocoding calls, with in-memory caching for repeat places).
- Vercel preview URLs are different origins; add them to `CORS_ALLOWED_ORIGINS` if you want to use them.
- The API has no database, cookies or login, so Django's CSRF middleware is not used. `manage.py check --deploy`
  still lists CSRF and two optional HSTS settings; that is expected.

## 8. Assessment checklist

Against the assessment and the master spec (section 17). A tick means it was run or tested here, not just written.

| Item | Status |
|---|---|
| Django backend works | Yes; 206 tests, and run against the live routing service |
| React frontend works | Yes; tried in Chrome (dark mode) |
| Current, pickup, drop-off and cycle inputs | Yes, with validation on both sides |
| Locations are geocoded; a real route is drawn on a map | Yes (OpenRouteService, OpenStreetMap tiles) |
| Fuel, rest, pickup and drop-off stops visible | Yes: map markers, legend and timeline |
| 11-hour, 14-hour, 30-minute and 70-hour rules enforced | Yes, and re-checked by a separate validator |
| Pickup and drop-off 1 hour each, counted as on duty | Yes |
| Fuel at least every 1,000 miles | Yes (30-minute stops, assumed); named at a real petrol station when OpenStreetMap answers |
| Trips span several days; one sheet per day | Yes (for example 6 sheets for Los Angeles to Chicago) |
| ELD grid drawn, not just text | Yes (SVG) |
| Daily status totals reconcile to 24 hours | Yes, checked in code and tests |
| Cycle usage tracked | Yes |
| Edge cases tested | Yes: exact 8 h and 11 h, 14-hour window, cycle near 70, 34-hour restart, fuel at 999/1,000/1,001 miles, bad input, provider failures |
| UI polished and responsive | Polished and checked on a desktop-width window in light and dark mode. **Not checked on a phone** |
| README complete | Yes |
| Deployment works | **Not hosted yet** (section 7) |
| Loom can be recorded in 3 to 5 minutes | Script ready |
| No invented claims | Yes. Nothing here says it is hosted, and test counts are from real runs |

## 9. Known gaps and limits

- **Not hosted.** The configuration is ready; creating the accounts is yours to do.
- **Phone layout was not looked at.** It is built (single column on small screens) but I have not seen it. Light
  mode and dark mode were both checked on a desktop-width window.
- **Address pick lists exist for eight countries** (India, US, Canada, UK, Australia, Germany, Mexico, UAE). Elsewhere
  the region is free text. Districts are always free text; there is no list of every district.
- **The India example was checked in the form, not end to end.** The routing service's free daily geocoding quota ran
  out during testing, so the fall-back search is covered by unit tests with fake responses, not yet by a live run.
  Quota exhaustion now shows a clear message instead of a key error.
- **Truck speeds are conservative.** The routing service's truck profile gave about 5 hours for 194 miles, so trips
  run longer than a real driver's. Times are only as good as the provider's.
- **Single routing limit.** One plan cannot exceed about 3,700 miles in total (the provider's 6,000 km cap).
- **Assumptions that are choices, not rules**: 30-minute fuel stops, a fully rested start, cycle hours before the trip
  never roll off, no traffic or weather. They are shown in the app on the audit tab.
- **Not modelled**: split sleeper, adverse conditions, short-haul exceptions, inspections, team drivers, time-zone
  changes during the trip, and the "last 5 days" recap figure.
- **Fuel stops use a real petrol station only when one is found** (best effort, see section 5.7). Breaks and rests are
  still placed where a limit is reached, not at real truck stops, and described as "near City, ST"
  (or "near City, CC" outside the US, with the ISO country code).
- **The rules are the US federal ones (FMCSA)**, applied to every trip, including trips elsewhere in the world.
  The assessment does not say to restrict the app to the US, so it does not. Ambiguous names ("Paris") resolve to
  the geocoder's top match; add a state or country to be specific.

---

## 10. How to explain this project (for a walkthrough or interview)

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

**Be honest about status.** The live hosting is not set up yet (sections 1 and 7), and section 9 lists what was not checked. Only describe what is in the
code.
