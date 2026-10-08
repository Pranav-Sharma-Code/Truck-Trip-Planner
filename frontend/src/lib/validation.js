import { postalError } from './countries'
import { LOCATION_KEYS, composeQuery, effectiveCountry } from './locations'
import { toIsoWithOffset } from './startTime'

export const MAX_LOCATION_LENGTH = 200
export const MAX_CYCLE_HOURS = 70

export const placeName = (key) => `${key}_location`
export const postalName = (key) => `${key}_postal`

const FIELD_NAMES = [
  ...LOCATION_KEYS.flatMap((key) => [placeName(key), postalName(key)]),
  'current_cycle_used_hours',
  'start_time',
]

export function validateField(name, values) {
  const key = LOCATION_KEYS.find((candidate) => name === placeName(candidate) || name === postalName(candidate))

  if (key) {
    const location = values[key]
    if (name === postalName(key)) return postalError(effectiveCountry(location, values.country), location.postal)

    if (!location.place.trim() && !location.postal.trim()) return 'Enter a place or a postal code'
    if (composeQuery(location).length > MAX_LOCATION_LENGTH) return `Keep it under ${MAX_LOCATION_LENGTH} characters`
    return null
  }

  if (name === 'current_cycle_used_hours') {
    const text = values.current_cycle_used_hours
    if (text.trim() === '') return 'Enter the hours used'
    const hours = Number(text)
    if (!Number.isFinite(hours)) return 'Enter a number'
    if (hours < 0 || hours > MAX_CYCLE_HOURS) return `Must be between 0 and ${MAX_CYCLE_HOURS}`
    return null
  }

  if (name === 'start_time' && values.start_time && toIsoWithOffset(values.start_time) === null) {
    return 'Enter a valid date and time'
  }
  return null
}

export function validateTrip(values) {
  const errors = {}
  for (const name of FIELD_NAMES) {
    const message = validateField(name, values)
    if (message) errors[name] = message
  }
  return errors
}

export function toRequest(values) {
  const request = { current_cycle_used_hours: Number(values.current_cycle_used_hours) }
  for (const key of LOCATION_KEYS) {
    request[placeName(key)] = composeQuery(values[key])
    const country = effectiveCountry(values[key], values.country)
    if (country) request[`${key}_country`] = country

    const { place, area, region, postal } = values[key]
    if (area.trim() || region.trim() || postal.trim()) {
      request[`${key}_parts`] = { place: place.trim(), area: area.trim(), region: region.trim(), postal: postal.trim() }
    }
  }
  if (values.start_time) request.start_time = toIsoWithOffset(values.start_time)
  return request
}
