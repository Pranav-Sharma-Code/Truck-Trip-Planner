# HOS Trip Planner

A full-stack trip planning application for truck drivers that calculates routes, schedules mandatory breaks and rest stops, and generates daily Hours of Service (HOS) log sheets based on the 70-hour / 8-day cycle rules.

## Problem Solving

* Automates truck trip planning and stop scheduling.
* Helps drivers follow driving-time and rest-period regulations.
* Tracks driving hours and remaining cycle hours.
* Generates daily log sheets for record-keeping.
* Validates schedules to identify potential HOS violations.

## Technologies Used

| Category            | Technologies                          |
| ------------------- | ------------------------------------- |
| Frontend            | React, Vite, JavaScript, Tailwind CSS |
| Backend             | Python, Django, Django REST Framework |
| Maps                | Leaflet, OpenStreetMap                |
| Routing & Geocoding | OpenRouteService, Nominatim           |
| Testing             | Pytest, frontend unit tests           |
| Deployment          | Vercel, Render                        |

## Architecture

The application follows a client-server architecture.

1. **Frontend:** Collects trip details and displays routes, stops, timelines, and logs.
2. **REST API:** Handles requests, validates inputs, and returns trip results.
3. **Trip Planning Service:** Coordinates geocoding, routing, scheduling, and log generation.
4. **HOS Engine:** Calculates driving limits, breaks, rest periods, and cycle usage.
5. **Validator:** Independently checks the schedule for rule violations.
6. **Output:** Provides route details, trip summaries, compliance results, and daily logs.

### Workflow

`User Input → Geocoding & Routing → HOS Scheduler → Validation → Daily Log Generation → Results`

## Key Features

* Truck route planning with interactive maps.
* Automatic fuel stops, breaks, and rest scheduling.
* HOS rule validation.
* Daily log sheet generation.
* Editable daily logs: change times, statuses and places, or fill a day in by hand from a blank sheet.
* Deviation tracking: every difference from the planned log is shown (hours per duty status, miles, the exact stretches and places that differ), with the plan drawn as a dashed line on the sheet.
* Rule check of edited logs: edits are re-checked against the HOS rules, and any rule they break is shown with its day and time.
* Print and save logs as PDF.
* Trip timeline and summary dashboard.
* Country-aware address inputs.
* Light, dark, and system themes.

## API

**Endpoint:** `POST /api/trips/plan/`

Accepts the current location, pickup location, drop-off location, cycle hours already used, and an optional start time.

Returns route information, scheduled stops, daily logs, trip summaries, compliance results, and warnings.

**Endpoint:** `POST /api/logs/check/`

Accepts a set of daily logs (consecutive days, each running 00:00 to 24:00 as duty-status segments), the UTC offset, and the cycle hours used before the trip. Returns whether the logs follow the HOS rules and, if not, each violation with its day and time. It uses the same validator as the planner, and is used to check logs after they are edited. Edits themselves are kept in the browser, not on the server.

## Testing

* **Backend:** 227 tests.
* **Frontend:** 98 tests.

Tests cover scheduling rules, HOS validation, route handling, daily logs, log editing and deviation tracking, input validation, and edge cases. The daily log builder is also checked against the worked example printed in the FMCSA driver's guide.

## Setup

### Backend

Requirements: Python 3.12 or newer.

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment, then run:

```bash
pip install -r requirements-dev.txt
```

Create a `.env` file from `.env.example`, configure the required environment variables, and start the server:

```bash
python manage.py runserver
```

### Frontend

Requirements: Node.js 20 or newer.

```bash
cd frontend
npm install
```

Create a `.env` file from `.env.example` and configure `VITE_API_BASE_URL`.

Start the development server:

```bash
npm run dev
```

## Deployment

* **Backend:** Render
* **Frontend:** Vercel

Deployment configuration is prepared, but the live hosted application has not yet been deployed.

## Limitations

* Trip duration depends on the routing provider's estimates.
* Routing is subject to API quotas and distance limits.
* Some advanced HOS exceptions and split-sleeper rules are not implemented.
* Log edits are stored in the browser for the trip on screen only. Cycle figures on edited days are estimates; the rule check is exact.
* Fuel station identification depends on OpenStreetMap data availability.
* Mobile responsiveness has not been fully verified.

## License & Data Sources

* [OpenStreetMap](https://www.openstreetmap.org/copyright) — map data.
* [GeoNames](https://www.geonames.org/) — geographic place data, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
