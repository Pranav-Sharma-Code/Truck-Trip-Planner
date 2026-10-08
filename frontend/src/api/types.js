// Shape of the API, for editor hints. The backend validates everything; nothing here runs.

/**
 * @typedef {Object} TripRequest
 * @property {string} current_location
 * @property {string} pickup_location
 * @property {string} dropoff_location
 * @property {string} [current_country]  ISO 3166-1 alpha-2 code; limits the search to that country
 * @property {string} [pickup_country]
 * @property {string} [dropoff_country]
 * @property {number} current_cycle_used_hours  0 to 70
 * @property {string} [start_time]  ISO 8601 with a UTC offset
 */

/**
 * @typedef {'OFF_DUTY'|'SLEEPER_BERTH'|'DRIVING'|'ON_DUTY_NOT_DRIVING'} DutyStatus
 * @typedef {'DRIVE'|'PICKUP'|'DROPOFF'|'FUEL'|'BREAK'|'REST'|'RESTART'} EventType
 */

/**
 * @typedef {Object} Place
 * @property {number} lat
 * @property {number} lon
 * @property {string} label
 */

/**
 * @typedef {Object} TripEvent
 * @property {number} id
 * @property {EventType} type
 * @property {DutyStatus} duty_status
 * @property {string} start  ISO 8601, in the trip's own UTC offset
 * @property {string} end
 * @property {number} duration_minutes
 * @property {number} start_mile
 * @property {number} end_mile
 * @property {Place} location      where the event starts
 * @property {Place} end_location  where the event ends
 * @property {{name: string, lat: number, lon: number}|null} station  the real petrol station for a fuel stop, if one was found
 * @property {string} reason
 * @property {string} rule
 * @property {Object} clocks_after
 */

/**
 * @typedef {Object} LogSegment
 * @property {DutyStatus} status
 * @property {number} start_minute  minutes after midnight
 * @property {number} end_minute
 */

/**
 * @typedef {Object} DailyLog
 * @property {string} date  YYYY-MM-DD
 * @property {LogSegment[]} segments
 * @property {Record<DutyStatus, number>} totals_minutes
 * @property {Record<DutyStatus, number>} totals_hours
 * @property {number} total_miles
 * @property {string|null} from_label
 * @property {string|null} to_label
 * @property {{minute: number, location: string|null, note: string}[]} remarks
 * @property {{on_duty_minutes_today: number, cycle_used_minutes: number,
 *   cycle_available_minutes: number, restart_completed: boolean}} recap
 */

/**
 * @typedef {Object} TripPlan
 * @property {Record<'current'|'pickup'|'dropoff', Place & {input: string}>} locations
 * @property {{distance_miles: number, driving_minutes: number, geometry: number[][],
 *   legs: {from: string, to: string, distance_miles: number, duration_minutes: number}[]}} route
 * @property {TripEvent[]} events
 * @property {DailyLog[]} daily_logs
 * @property {Object} summary
 * @property {{ok: boolean, violations: {code: string, message: string, event_id: number}[]}} compliance
 * @property {{code: string, message: string}[]} warnings
 * @property {string[]} assumptions
 */

export {}
