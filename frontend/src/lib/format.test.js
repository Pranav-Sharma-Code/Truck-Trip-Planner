import { describe, expect, it } from 'vitest'

import {
  formatDate,
  formatDuration,
  formatHours,
  formatMiles,
  formatMinuteOfDay,
  formatTime,
  formatTimeRange,
} from './format'

describe('formatTime', () => {
  it('reads the clock time from the string without converting timezones', () => {
    expect(formatTime('2026-10-12T14:05:00-05:00')).toBe('2:05 PM')
    expect(formatTime('2026-10-12T06:00:00+05:30')).toBe('6:00 AM')
  })

  it('handles midnight and noon', () => {
    expect(formatTime('2026-10-12T00:00:00-05:00')).toBe('12:00 AM')
    expect(formatTime('2026-10-12T12:00:00-05:00')).toBe('12:00 PM')
  })

  it('returns an empty string for junk', () => {
    expect(formatTime('later')).toBe('')
  })
})

describe('formatDate', () => {
  it('formats a timestamp or a plain date', () => {
    expect(formatDate('2026-10-12T06:00:00-05:00')).toBe('Mon, Oct 12')
    expect(formatDate('2026-10-12')).toBe('Mon, Oct 12')
    expect(formatDate('2026-10-12', { weekday: false })).toBe('Oct 12')
  })
})

describe('formatDuration', () => {
  it('shows hours and minutes', () => {
    expect(formatDuration(70)).toBe('1 h 10 m')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(45)).toBe('45 m')
    expect(formatDuration(2040)).toBe('34 h')
  })

  it('formats fractional hours', () => {
    expect(formatHours(6.38)).toBe('6 h 23 m')
  })
})

describe('formatMiles', () => {
  it('rounds and groups thousands', () => {
    expect(formatMiles(2136.1)).toBe('2,136 mi')
    expect(formatMiles(37.2)).toBe('37 mi')
  })
})

describe('formatMinuteOfDay', () => {
  it('turns a minute of the day into a clock label', () => {
    expect(formatMinuteOfDay(0)).toBe('12:00 AM')
    expect(formatMinuteOfDay(870)).toBe('2:30 PM')
  })
})

describe('formatTimeRange', () => {
  it('shows a plain range within a day', () => {
    expect(formatTimeRange('2026-10-12T06:00:00-05:00', '2026-10-12T09:00:00-05:00')).toBe('6:00 AM \u2013 9:00 AM')
  })

  it('marks events that end on a later day', () => {
    expect(formatTimeRange('2026-10-12T18:30:00-05:00', '2026-10-13T04:30:00-05:00')).toBe('6:30 PM \u2013 4:30 AM (+1 d)')
    expect(formatTimeRange('2026-10-12T10:00:00-05:00', '2026-10-13T20:00:00-05:00')).toBe('10:00 AM \u2013 8:00 PM (+1 d)')
    expect(formatTimeRange('2026-10-12T08:00:00-05:00', '2026-10-14T18:00:00-05:00')).toContain('(+2 d)')
  })
})
