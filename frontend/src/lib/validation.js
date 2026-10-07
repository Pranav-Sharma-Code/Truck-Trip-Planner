import { toIsoWithOffset } from './startTime'

export const MAX_LOCATION_LENGTH = 200
export const MAX_CYCLE_HOURS = 70

export const LOCATION_FIELDS = ['current_location', 'pickup_location', 'dropoff_location']

// Mirrors the API rules so mistakes show up as the user types; the API still checks everything.
export function validateField(name, value) {
  if (LOCATION_FIELDS.includes(name)) {
    const text = value.trim()
    if (!text) return 'Enter a location'
    if (text.length > MAX_LOCATION_LENGTH) return `Keep it under ${MAX_LOCATION_LENGTH} characters`
    return null
  }

  if (name === 'current_cycle_used_hours') {
    if (value.trim() === '') return 'Enter the hours used'
    const hours = Number(value)
    if (!Number.isFinite(hours)) return 'Enter a number'
    if (hours < 0 || hours > MAX_CYCLE_HOURS) return `Must be between 0 and ${MAX_CYCLE_HOURS}`
    return null
  }

  if (name === 'start_time' && value && toIsoWithOffset(value) === null) {
    return 'Enter a valid date and time'
  }
  return null
}

export function validateTrip(values) {
  const errors = {}
  for (const name of [...LOCATION_FIELDS, 'current_cycle_used_hours', 'start_time']) {
    const message = validateField(name, values[name] ?? '')
    if (message) errors[name] = message
  }
  return errors
}

/** Form values (all strings) to the API request body. */
export function toRequest(values) {
  const request = {
    current_location: values.current_location.trim(),
    pickup_location: values.pickup_location.trim(),
    dropoff_location: values.dropoff_location.trim(),
    current_cycle_used_hours: Number(values.current_cycle_used_hours),
  }
  if (values.start_time) request.start_time = toIsoWithOffset(values.start_time)
  return request
}
