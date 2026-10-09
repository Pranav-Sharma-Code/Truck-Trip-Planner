import { describe, expect, it } from 'vitest'

import example from '../components/logs/__fixtures__/fmcsaExample.json'
import {
  MINUTES_PER_DAY,
  applyEdits,
  blankEdit,
  changeProblems,
  changesFromLog,
  compareDay,
  diffSegments,
  editFromLog,
  formatDelta,
  minuteToTime,
  remarksFromChanges,
  segmentsFromChanges,
  summarizeComparisons,
  timeToMinute,
  totalsOf,
} from './logEdit'

const row = (minute, status, location = 'Somewhere, ST', note = '') => ({ id: `r${minute}`, minute, status, location, note })
const sum = (totals) => Object.values(totals).reduce((a, b) => a + b, 0)

// More planned days like the example, with a given cycle figure. Their recap agrees with their own segments.
const EXAMPLE_ON_DUTY = example.totals_minutes.DRIVING + example.totals_minutes.ON_DUTY_NOT_DRIVING
const day = (date, cycleUsed, extra = {}) => ({
  ...example,
  date,
  recap: { ...example.recap, on_duty_minutes_today: EXAMPLE_ON_DUTY, cycle_used_minutes: cycleUsed, cycle_available_minutes: 4200 - cycleUsed, restart_completed: false, ...extra },
})

describe('times', () => {
  it('converts between minutes and HH:MM', () => {
    expect(minuteToTime(0)).toBe('00:00')
    expect(minuteToTime(1439)).toBe('23:59')
    expect(timeToMinute('06:30')).toBe(390)
    expect(timeToMinute('24:00')).toBeNull()
    expect(timeToMinute('6:30')).toBeNull()
    expect(timeToMinute('')).toBeNull()
  })

  it('formats a signed difference', () => {
    expect(formatDelta(30)).toBe('+0:30')
    expect(formatDelta(-75)).toBe('-1:15')
    expect(formatDelta(0)).toBe('0:00')
  })
})

describe('rows and segments', () => {
  it('turns the planned FMCSA day into rows and back into exactly the same segments', () => {
    const changes = changesFromLog(example)
    expect(changes).toHaveLength(example.segments.length)
    expect(segmentsFromChanges(changes)).toEqual(example.segments)
  })

  it('carries the places and notes of the plan into the rows, and back into the remarks', () => {
    const changes = changesFromLog(example)
    expect(changes.find((c) => c.minute === 6 * 60).location).toBe('Richmond, VA')
    expect(remarksFromChanges(changes).map((r) => r.location)).toEqual(
      expect.arrayContaining(['Richmond, VA', 'Fredericksburg, VA', 'Baltimore, MD', 'Philadelphia, PA', 'Cherry Hill, NJ', 'Newark, NJ']),
    )
  })

  it('always covers the whole day, whatever the rows are', () => {
    const rows = [row(0, 'OFF_DUTY'), row(600, 'DRIVING'), row(300, 'ON_DUTY_NOT_DRIVING'), row(900, 'SLEEPER_BERTH')]
    const segments = segmentsFromChanges(rows)
    expect(segments[0].start_minute).toBe(0)
    expect(segments.at(-1).end_minute).toBe(MINUTES_PER_DAY)
    segments.slice(1).forEach((s, i) => expect(s.start_minute).toBe(segments[i].end_minute))
    expect(sum(totalsOf(segments))).toBe(MINUTES_PER_DAY)
  })

  it('sorts rows by time, whatever order they were typed in', () => {
    const segments = segmentsFromChanges([row(900, 'OFF_DUTY'), row(0, 'OFF_DUTY'), row(360, 'DRIVING')])
    expect(segments.map((s) => [s.status, s.start_minute, s.end_minute])).toEqual([
      ['OFF_DUTY', 0, 360],
      ['DRIVING', 360, 900],
      ['OFF_DUTY', 900, MINUTES_PER_DAY],
    ])
  })

  it('merges neighbours with the same status', () => {
    const segments = segmentsFromChanges([row(0, 'OFF_DUTY'), row(300, 'OFF_DUTY'), row(600, 'DRIVING')])
    expect(segments).toEqual([
      { status: 'OFF_DUTY', start_minute: 0, end_minute: 600 },
      { status: 'DRIVING', start_minute: 600, end_minute: MINUTES_PER_DAY },
    ])
  })

  it('a blank day is off duty for the whole day', () => {
    const edit = blankEdit()
    expect(segmentsFromChanges(edit.changes)).toEqual([{ status: 'OFF_DUTY', start_minute: 0, end_minute: MINUTES_PER_DAY }])
    expect(edit.miles).toBe('0')
  })

  it('names a remark after its status when no note was typed', () => {
    const remarks = remarksFromChanges([row(0, 'OFF_DUTY', ''), row(360, 'ON_DUTY_NOT_DRIVING', 'Richmond, VA')])
    expect(remarks).toEqual([{ minute: 360, location: 'Richmond, VA', note: 'On Duty' }])
  })
})

describe('changeProblems', () => {
  it('flags a second change at the same time and invalid times', () => {
    const { errors } = changeProblems([row(0, 'OFF_DUTY'), row(360, 'DRIVING'), row(360, 'OFF_DUTY'), { ...row(10, 'DRIVING'), minute: NaN, id: 'bad' }])
    expect(Object.values(errors).sort()).toEqual(['Another change is at this time', 'Enter a valid time'])
    expect(errors.bad).toBe('Enter a valid time')
  })

  it('only warns about a missing place', () => {
    const { errors, warnings } = changeProblems([row(0, 'OFF_DUTY', ''), row(360, 'DRIVING', 'Richmond, VA')])
    expect(errors).toEqual({})
    expect(Object.keys(warnings)).toEqual(['r0'])
  })
})

describe('applyEdits', () => {
  it('returns the planned logs untouched when nothing is edited', () => {
    const logs = [example]
    const actual = applyEdits(logs, {})
    expect(actual[0]).toBe(example)
  })

  it('redraws an edited day with new totals, miles, places and remarks', () => {
    const edit = editFromLog(example)
    edit.changes = edit.changes.map((c) => (c.minute === 7 * 60 + 30 ? { ...c, minute: 7 * 60 + 45 } : c)) // left 15 minutes late
    edit.miles = '362.5'
    edit.to = 'Newark Terminal, NJ'

    const [actual] = applyEdits([example], { [example.date]: edit })

    expect(actual.totals_minutes.ON_DUTY_NOT_DRIVING).toBe(example.totals_minutes.ON_DUTY_NOT_DRIVING + 15)
    expect(actual.totals_minutes.DRIVING).toBe(example.totals_minutes.DRIVING - 15)
    expect(sum(actual.totals_minutes)).toBe(MINUTES_PER_DAY)
    expect(actual.total_miles).toBe(362.5)
    expect(actual.to_label).toBe('Newark Terminal, NJ')
    expect(actual.recap.on_duty_minutes_today).toBe(actual.totals_minutes.DRIVING + actual.totals_minutes.ON_DUTY_NOT_DRIVING)
  })

  it('moves the cycle figures on the edited day and every day after it', () => {
    const logs = [day('2026-10-08', 735), day('2026-10-09', 1470), day('2026-10-10', 2205)]
    const edit = editFromLog(logs[0])
    edit.changes = [...edit.changes, row(1300, 'ON_DUTY_NOT_DRIVING', 'Yard')] // on duty again from 21:40 instead of off duty
    const actual = applyEdits(logs, { [logs[0].date]: edit })

    const extra = actual[0].recap.on_duty_minutes_today - EXAMPLE_ON_DUTY
    expect(extra).toBe(MINUTES_PER_DAY - 1300)
    expect(actual[0].recap.cycle_used_minutes).toBe(735 + extra)
    expect(actual[1].recap.cycle_used_minutes).toBe(1470 + extra)
    expect(actual[2].recap.cycle_used_minutes).toBe(2205 + extra)
    expect(actual[2].recap.cycle_available_minutes).toBe(4200 - 2205 - extra)
    expect(actual[1].segments).toEqual(logs[1].segments) // later days keep their own times
  })

  it('stops carrying the change forward after a 34-hour restart', () => {
    const logs = [day('2026-10-08', 735), day('2026-10-09', 100, { restart_completed: true }), day('2026-10-10', 835)]
    const edit = editFromLog(logs[0])
    edit.changes.push(row(1300, 'ON_DUTY_NOT_DRIVING', 'Yard'))
    const actual = applyEdits(logs, { [logs[0].date]: edit })

    expect(actual[0].recap.cycle_used_minutes).toBeGreaterThan(735)
    expect(actual[1].recap.cycle_used_minutes).toBe(100) // the restart wiped the earlier hours
    expect(actual[2].recap.cycle_used_minutes).toBe(835)
  })

  it('treats a blank, unfilled day as having no miles and no duty', () => {
    const [actual] = applyEdits([example], { [example.date]: blankEdit() })
    expect(actual.total_miles).toBe(0)
    expect(actual.totals_minutes.OFF_DUTY).toBe(MINUTES_PER_DAY)
    expect(actual.recap.on_duty_minutes_today).toBe(0)
  })

  it('ignores a miles value that is not a number', () => {
    const edit = { ...editFromLog(example), miles: 'abc' }
    expect(applyEdits([example], { [example.date]: edit })[0].total_miles).toBe(0)
  })
})

describe('comparing with the plan', () => {
  it('finds no deviation in an untouched or unchanged day', () => {
    expect(compareDay(example, example).changed).toBe(false)
    const [same] = applyEdits([example], { [example.date]: editFromLog(example) })
    const comparison = compareDay(example, same)
    expect(comparison.changed).toBe(false)
    expect(comparison.minutesDifferent).toBe(0)
  })

  it('lists the stretches where the status differs from the plan', () => {
    const planned = [
      { status: 'OFF_DUTY', start_minute: 0, end_minute: 360 },
      { status: 'DRIVING', start_minute: 360, end_minute: 720 },
      { status: 'OFF_DUTY', start_minute: 720, end_minute: MINUTES_PER_DAY },
    ]
    const actual = [
      { status: 'OFF_DUTY', start_minute: 0, end_minute: 390 }, // left 30 minutes late
      { status: 'DRIVING', start_minute: 390, end_minute: 700 },
      { status: 'ON_DUTY_NOT_DRIVING', start_minute: 700, end_minute: 760 },
      { status: 'OFF_DUTY', start_minute: 760, end_minute: MINUTES_PER_DAY },
    ]
    expect(diffSegments(planned, actual)).toEqual([
      { start: 360, end: 390, planned: 'DRIVING', actual: 'OFF_DUTY' },
      { start: 700, end: 720, planned: 'DRIVING', actual: 'ON_DUTY_NOT_DRIVING' },
      { start: 720, end: 760, planned: 'OFF_DUTY', actual: 'ON_DUTY_NOT_DRIVING' },
    ])
  })

  it('reports the change in each status total, in miles, and in places', () => {
    const edit = editFromLog(example)
    edit.changes = edit.changes.map((c) => (c.minute === 12 * 60 ? { ...c, minute: 12 * 60 + 30, location: 'Annapolis Junction, MD' } : c)) // lunch 30 min later
    edit.miles = '340'
    const [actual] = applyEdits([example], { [example.date]: edit })
    const comparison = compareDay(example, actual)

    expect(comparison.changed).toBe(true)
    // Lunch used to start at 12:00; it now starts at 12:30 (and still ends at 13:00), so 12:00-12:30 is driving instead of off duty.
    expect(comparison.minutesDifferent).toBe(30)
    expect(comparison.intervals).toEqual([{ start: 720, end: 750, planned: 'OFF_DUTY', actual: 'DRIVING' }])
    expect(comparison.totalsDelta.DRIVING).toBe(30)
    expect(comparison.totalsDelta.OFF_DUTY).toBe(-30)
    expect(comparison.milesDelta).toBe(-10)
    expect(comparison.placeChanges).toEqual([]) // the moved row is a new place, not a changed one
    expect(sum(comparison.totalsDelta)).toBe(0)
  })

  it('reports a place that differs at the same time', () => {
    const edit = editFromLog(example)
    edit.changes = edit.changes.map((c) => (c.minute === 9 * 60 ? { ...c, location: 'Ashland, VA' } : c))
    const [actual] = applyEdits([example], { [example.date]: edit })
    expect(compareDay(example, actual).placeChanges).toEqual([{ minute: 540, planned: 'Fredericksburg, VA', actual: 'Ashland, VA' }])
  })

  it('totals the differences across days', () => {
    const logs = [example, { ...example, date: '2026-10-10' }]
    const edit = blankEdit()
    const actual = applyEdits(logs, { [logs[0].date]: edit })
    const summary = summarizeComparisons(logs.map((planned, i) => compareDay(planned, actual[i])))
    expect(summary.daysChanged).toBe(1)
    expect(summary.dates).toEqual([example.date])
    expect(summary.drivingDelta).toBe(-example.totals_minutes.DRIVING)
    expect(summary.milesDelta).toBe(-example.total_miles)
  })
})
