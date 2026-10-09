# Loom walkthrough (3 to 5 minutes)

Say only what is true of the code. Use the hosted link once it exists; until then run the app locally.
Before recording: open the live site a minute early so the free server is awake, and have the repo open in your editor.

## 0:00 – What it is (30 s)

"This is a trip planner for truck drivers on the 70-hour, 8-day schedule. I enter where the truck is, where to pick up,
where to deliver and how many cycle hours are already used. It works out the real route, schedules every stop the
hours-of-service rules require, and draws the daily log sheets."

## 0:30 – Demo: a multi-day trip (1 min 15 s)

1. Show the **Light / Dark / System** switch. Click **India trip**: the country is India and the address fields use
   State / UT, District and PIN code (change the country to show the labels change). Then click **Multi-day**
   (Los Angeles, Phoenix, Chicago, 20 hours used) and **Plan trip**.
2. Summary cards: distance, trip time, 6 log sheets, cycle used. Point at the amber note: the cycle ran out, so a
   34-hour restart was scheduled.
3. Map: the route line, pickup B and drop-off C, fuel stops, breaks, rests, the restart. Open a popup.
4. Timeline: click a stop; the map zooms to it. Read one reason aloud, for example the 30-minute break after 8 hours
   of driving and its regulation.

## 1:45 – The log sheets (1 min)

Open **Daily logs**. Show day 1 and a middle day: the 24-hour grid, the duty line with its vertical connectors, the
totals that add to 24:00, the numbered remarks, the recap. Type a carrier name in **Sheet details** to show it appear.
Click **Edit this day**, move a time and change a status: the sheet redraws, the summary shows how this day differs from
the plan (with the plan as a dashed orange line), and the rule check names any rule the edit breaks. Mention **Start blank**
for filling a day in by hand, and print or save as PDF, one sheet per page.

## 2:45 – How it works (1 min)

- Flow: geocode and route (OpenRouteService), then the **scheduler**, then a separate **validator**, then the daily
  logs, then the React UI.
- The scheduler is plain Python with no Django or network. It tracks the 11-hour limit, 14-hour window, 8-hour break,
  70-hour cycle and fuel interval, and each loop picks the next stop in priority order: restart, rest, fuel, break,
  else drive as far as the tightest limit allows.
- Time is whole minutes, to avoid floating-point drift.
- Every stop carries its reason and rule, shown in the timeline and on the **HOS audit** tab.

## 3:45 – Testing and honesty (45 s)

- 227 backend tests and 98 frontend tests. Edge cases: exactly 8 and 11 hours, the 14-hour window, cycle near 70,
  fuel at 999, 1,000 and 1,001 miles. 300 random trips must all pass the validator.
- The validator re-checks a finished plan by looking backwards, so a bug in the scheduler's counters cannot hide.
- Limits: a 30-minute fuel stop is my assumption; a fully rested start; no traffic or weather; the provider's truck
  speeds are conservative; no split sleeper or exceptions. These are listed in the README and on the audit tab.

## 4:30 – Wrap-up (20 s)

"Django and DRF backend on Render, React and Vite frontend on Vercel, code on GitHub. The README explains the
structure, the rules and how to run it."

Do not claim features that are not in the code, and do not describe hosting you have not set up.
