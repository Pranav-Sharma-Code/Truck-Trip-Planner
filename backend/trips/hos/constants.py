"""HOS limits for a property-carrying driver on the 70-hour/8-day schedule.

All durations are in minutes. Sources: FMCSA Interstate Truck Driver's Guide to
Hours of Service (April 2022) and the assessment's stated assumptions.
"""

MAX_DRIVING_PER_SHIFT = 11 * 60  # 395.3(a)(3)
DUTY_WINDOW = 14 * 60  # 395.3(a)(2)
SHIFT_RESET_OFF_DUTY = 10 * 60  # off duty / sleeper berth needed to restart the 11h and 14h clocks

DRIVING_BEFORE_BREAK = 8 * 60  # 395.3(a)(3)(ii), cumulative driving
BREAK_DURATION = 30  # consecutive non-driving minutes

CYCLE_LIMIT = 70 * 60  # 395.3(b)
CYCLE_DAYS = 8
RESTART_OFF_DUTY = 34 * 60  # 395.3(c)

# Assessment assumptions
PICKUP_DURATION = 60
DROPOFF_DURATION = 60
FUEL_INTERVAL_MILES = 1000

# Not specified by the assessment; our own assumption.
FUEL_STOP_DURATION = 30

RULE_DRIVING_LIMIT = "395.3(a)(3)"
RULE_DUTY_WINDOW = "395.3(a)(2)"
RULE_BREAK = "395.3(a)(3)(ii)"
RULE_CYCLE = "395.3(b)"
RULE_RESTART = "395.3(c)"
RULE_ASSESSMENT = "assessment"
