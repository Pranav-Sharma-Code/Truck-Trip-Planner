import { describe, expect, it } from 'vitest'

import { defaultStartValue, toIsoWithOffset } from './startTime'
import { toRequest, validateField, validateTrip } from './validation'

const valid = {
  current_location: 'Dallas, TX',
  pickup_location: 'Fort Worth, TX',
  dropoff_location: 'Austin, TX',
  current_cycle_used_hours: '10',
  start_time: '',
}

describe('validateField', () => {
  it('requires locations and caps their length', () => {
    expect(validateField('pickup_location', '   ')).toBe('Enter a location')
    expect(validateField('pickup_location', 'x'.repeat(201))).toMatch(/under 200/)
    expect(validateField('pickup_location', 'Dallas, TX')).toBeNull()
  })

  it('accepts cycle hours from 0 to 70 inclusive', () => {
    for (const ok of ['0', '70', '24.5', ' 10 ']) {
      expect(validateField('current_cycle_used_hours', ok)).toBeNull()
    }
  })

  it('rejects cycle hours outside the range or not numbers', () => {
    expect(validateField('current_cycle_used_hours', '')).toBe('Enter the hours used')
    expect(validateField('current_cycle_used_hours', 'abc')).toBe('Enter a number')
    expect(validateField('current_cycle_used_hours', 'Infinity')).toBe('Enter a number')
    expect(validateField('current_cycle_used_hours', '-1')).toMatch(/between 0 and 70/)
    expect(validateField('current_cycle_used_hours', '70.1')).toMatch(/between 0 and 70/)
  })

  it('treats the start time as optional but checks it when present', () => {
    expect(validateField('start_time', '')).toBeNull()
    expect(validateField('start_time', '2026-10-12T06:00')).toBeNull()
    expect(validateField('start_time', '2026-02-31T06:00')).toBe('Enter a valid date and time')
  })
})

describe('validateTrip', () => {
  it('returns no errors for a good trip', () => {
    expect(validateTrip(valid)).toEqual({})
  })

  it('returns an error per bad field', () => {
    const errors = validateTrip({ ...valid, current_location: '', current_cycle_used_hours: '99' })
    expect(Object.keys(errors).sort()).toEqual(['current_cycle_used_hours', 'current_location'])
  })
})

describe('toRequest', () => {
  it('trims text, converts the cycle to a number and omits an empty start time', () => {
    const request = toRequest({ ...valid, current_location: '  Dallas, TX ', current_cycle_used_hours: '24.5' })
    expect(request).toEqual({
      current_location: 'Dallas, TX',
      pickup_location: 'Fort Worth, TX',
      dropoff_location: 'Austin, TX',
      current_cycle_used_hours: 24.5,
    })
  })

  it('includes the start time with a UTC offset', () => {
    const request = toRequest({ ...valid, start_time: '2026-10-12T06:00' })
    expect(request.start_time).toMatch(/^2026-10-12T06:00:00[+-]\d{2}:\d{2}$/)
  })
})

describe('start time helpers', () => {
  it('keeps the same instant when adding the offset', () => {
    const iso = toIsoWithOffset('2026-10-12T06:00')
    expect(new Date(iso).getTime()).toBe(new Date(2026, 9, 12, 6, 0).getTime())
  })

  it('rejects malformed or impossible values', () => {
    expect(toIsoWithOffset('tomorrow')).toBeNull()
    expect(toIsoWithOffset('2026-13-01T06:00')).toBeNull()
  })

  it('rounds the default start up to the next quarter hour', () => {
    expect(defaultStartValue(new Date(2026, 9, 12, 6, 7))).toBe('2026-10-12T06:15')
    expect(defaultStartValue(new Date(2026, 9, 12, 6, 15, 0))).toBe('2026-10-12T06:15')
    expect(defaultStartValue(new Date(2026, 9, 12, 6, 50))).toBe('2026-10-12T07:00')
  })
})
