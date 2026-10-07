import { describe, expect, it } from 'vitest'

import { buildMarkers, eventBounds, groupEventsByDay, START_ID } from './tripView'

const place = (label, lat = 32, lon = -97) => ({ lat, lon, label })

const event = (id, type, start, end, extra = {}) => ({
  id,
  type,
  start,
  end,
  duration_minutes: 60,
  location: place('Dallas, TX'),
  end_location: place('Waco, TX', 31.5, -97.1),
  reason: 'because',
  ...extra,
})

const plan = {
  locations: { current: place('Dallas, TX, USA', 32.7, -96.8) },
  events: [
    event(1, 'DRIVE', '2026-10-12T06:00:00-05:00', '2026-10-12T14:00:00-05:00'),
    event(2, 'BREAK', '2026-10-12T14:00:00-05:00', '2026-10-12T14:30:00-05:00'),
    event(3, 'PICKUP', '2026-10-12T14:30:00-05:00', '2026-10-12T15:30:00-05:00'),
    event(4, 'REST', '2026-10-12T18:00:00-05:00', '2026-10-13T04:00:00-05:00'),
    event(5, 'DROPOFF', '2026-10-13T09:00:00-05:00', '2026-10-13T10:00:00-05:00'),
  ],
}

describe('buildMarkers', () => {
  it('starts with the start marker and skips plain driving', () => {
    const markers = buildMarkers(plan)
    expect(markers.map((m) => m.type)).toEqual(['START', 'BREAK', 'PICKUP', 'REST', 'DROPOFF'])
    expect(markers[0].id).toBe(START_ID)
    expect(markers[0].detail).toBe('Dallas, TX')
  })

  it('uses the event id so the timeline and map can point at the same stop', () => {
    expect(buildMarkers(plan).map((m) => m.id)).toEqual([START_ID, 2, 3, 4, 5])
  })

  it('describes the stop for the popup', () => {
    const rest = buildMarkers(plan).find((m) => m.type === 'REST')
    expect(rest.title).toBe('10-hour rest')
    expect(rest.time).toBe('6:00 PM – 4:00 AM (+1 d) · 1 h')
    expect(rest.position).toEqual([32, -97])
  })
})

describe('groupEventsByDay', () => {
  it('groups by the day an event starts, numbering days from 1', () => {
    const days = groupEventsByDay(plan.events)
    expect(days.map((d) => [d.date, d.number, d.events.length])).toEqual([
      ['2026-10-12', 1, 4],
      ['2026-10-13', 2, 1],
    ])
  })

  it('handles an empty list', () => {
    expect(groupEventsByDay([])).toEqual([])
  })
})

describe('eventBounds', () => {
  it('spans from where the event starts to where it ends', () => {
    expect(eventBounds(plan.events[0])).toEqual([
      [32, -97],
      [31.5, -97.1],
    ])
  })
})
