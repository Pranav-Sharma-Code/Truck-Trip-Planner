import { describe, expect, it } from 'vitest'

import { defaultStartValue, toIsoWithOffset } from './startTime'
import { emptyLocation } from './locations'
import { toRequest, validateField, validateTrip } from './validation'

const place = (overrides) => ({ ...emptyLocation(), ...overrides })

const valid = () => ({
  country: '',
  current: place({ place: 'Dallas, TX' }),
  pickup: place({ place: 'Fort Worth, TX' }),
  dropoff: place({ place: 'Austin, TX' }),
  current_cycle_used_hours: '10',
  start_time: '',
})

describe('validateField: places', () => {
  it('needs a place or a postal code', () => {
    const values = { ...valid(), pickup: place() }
    expect(validateField('pickup_location', values)).toBe('Enter a place or a postal code')
    expect(validateField('pickup_location', { ...values, pickup: place({ place: '   ' }) })).toBe('Enter a place or a postal code')
  })

  it('accepts a postal code on its own', () => {
    const values = { ...valid(), country: 'IN', pickup: place({ postal: '411001' }) }
    expect(validateField('pickup_location', values)).toBeNull()
  })

  it('caps the length of the combined search text', () => {
    const values = { ...valid(), pickup: place({ place: 'x'.repeat(201) }) }
    expect(validateField('pickup_location', values)).toMatch(/under 200/)
  })
})

describe('validateField: postal codes follow the country', () => {
  it('checks a PIN code for India', () => {
    const india = (postal) => ({ ...valid(), country: 'IN', pickup: place({ place: 'Pune', postal }) })
    expect(validateField('pickup_postal', india('411001'))).toBeNull()
    expect(validateField('pickup_postal', india('41100'))).toMatch(/valid PIN code, for example 411001/)
    expect(validateField('pickup_postal', india('011001'))).toMatch(/PIN code/)
  })

  it('checks a ZIP code for the US', () => {
    const us = (postal) => ({ ...valid(), country: 'US', pickup: place({ place: 'Dallas', postal }) })
    expect(validateField('pickup_postal', us('75201'))).toBeNull()
    expect(validateField('pickup_postal', us('75201-1234'))).toBeNull()
    expect(validateField('pickup_postal', us('7520'))).toMatch(/ZIP code/)
  })

  it('uses the place own country over the trip country', () => {
    const values = { ...valid(), country: 'US', pickup: place({ place: 'Pune', country: 'IN', postal: '411001' }) }
    expect(validateField('pickup_postal', values)).toBeNull()
  })

  it('accepts anything for a country without a rule, and when empty', () => {
    expect(validateField('pickup_postal', { ...valid(), country: 'FR', pickup: place({ place: 'Paris', postal: '75001' }) })).toBeNull()
    expect(validateField('pickup_postal', { ...valid(), country: 'IN', pickup: place({ place: 'Pune' }) })).toBeNull()
  })
})

describe('validateField: cycle hours and start time', () => {
  const cycle = (value) => validateField('current_cycle_used_hours', { ...valid(), current_cycle_used_hours: value })

  it('accepts cycle hours from 0 to 70 inclusive', () => {
    for (const ok of ['0', '70', '24.5', ' 10 ']) expect(cycle(ok)).toBeNull()
  })

  it('rejects cycle hours outside the range or not numbers', () => {
    expect(cycle('')).toBe('Enter the hours used')
    expect(cycle('abc')).toBe('Enter a number')
    expect(cycle('Infinity')).toBe('Enter a number')
    expect(cycle('-1')).toMatch(/between 0 and 70/)
    expect(cycle('70.1')).toMatch(/between 0 and 70/)
  })

  it('treats the start time as optional but checks it when present', () => {
    const start = (value) => validateField('start_time', { ...valid(), start_time: value })
    expect(start('')).toBeNull()
    expect(start('2026-10-12T06:00')).toBeNull()
    expect(start('2026-02-31T06:00')).toBe('Enter a valid date and time')
  })
})

describe('validateTrip', () => {
  it('returns no errors for a good trip', () => {
    expect(validateTrip(valid())).toEqual({})
  })

  it('returns an error per bad field, keyed by input id', () => {
    const values = { ...valid(), current: place(), current_cycle_used_hours: '99' }
    expect(Object.keys(validateTrip(values)).sort()).toEqual(['current_cycle_used_hours', 'current_location'])
  })
})

describe('toRequest', () => {
  it('joins the parts of a place, most specific first, and omits countries when none is set', () => {
    const values = {
      ...valid(),
      current: place({ place: ' Pune ', area: 'Pune', region: 'Maharashtra', postal: '411001' }),
      current_cycle_used_hours: '24.5',
    }
    expect(toRequest(values)).toEqual({
      current_location: 'Pune, Pune, Maharashtra, 411001',
      current_parts: { place: 'Pune', area: 'Pune', region: 'Maharashtra', postal: '411001' },
      pickup_location: 'Fort Worth, TX',
      dropoff_location: 'Austin, TX',
      current_cycle_used_hours: 24.5,
    })
  })

  it('sends the address parts only for places that have details', () => {
    const values = {
      ...valid(),
      pickup: place({ place: 'Pune', area: ' Pune ', region: 'Maharashtra', postal: '411001' }),
    }
    const request = toRequest(values)
    expect(request.pickup_parts).toEqual({ place: 'Pune', area: 'Pune', region: 'Maharashtra', postal: '411001' })
    expect(request).not.toHaveProperty('current_parts')
    expect(request).not.toHaveProperty('dropoff_parts')
  })

  it('sends the trip country for every place, and a place country where it differs', () => {
    const values = { ...valid(), country: 'CA', pickup: place({ place: 'Chicago', country: 'US' }) }
    const request = toRequest(values)
    expect(request.current_country).toBe('CA')
    expect(request.pickup_country).toBe('US')
    expect(request.dropoff_country).toBe('CA')
  })

  it('includes the start time with a UTC offset', () => {
    const request = toRequest({ ...valid(), start_time: '2026-10-12T06:00' })
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
