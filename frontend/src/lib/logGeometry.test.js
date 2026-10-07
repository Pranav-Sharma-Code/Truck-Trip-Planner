import { describe, expect, it } from 'vitest'

import {
  GRID,
  GRID_RIGHT,
  HOUR_LABELS,
  dateParts,
  dutyLine,
  formatLogHours,
  gridTicks,
  minuteToX,
  placeRemarkMarkers,
  rowCenterY,
} from './logGeometry'

describe('minuteToX', () => {
  it('maps midnight to the left edge and the end of the day to the right edge', () => {
    expect(minuteToX(0)).toBe(GRID.x)
    expect(minuteToX(1440)).toBe(GRID_RIGHT)
  })

  it('puts noon in the middle and 30 px per hour', () => {
    expect(minuteToX(720)).toBe(GRID.x + 360)
    expect(minuteToX(60) - minuteToX(0)).toBe(GRID.hourWidth)
  })
})

describe('grid', () => {
  it('has 25 hour labels, midnight to midnight', () => {
    expect(HOUR_LABELS).toHaveLength(25)
    expect(HOUR_LABELS[12]).toBe('Noon')
  })

  it('has a tick every 15 minutes', () => {
    const ticks = gridTicks()
    expect(ticks).toHaveLength(97)
    expect(ticks.filter((tick) => tick.kind === 'hour')).toHaveLength(25)
    expect(ticks.filter((tick) => tick.kind === 'half')).toHaveLength(24)
    expect(ticks[1].kind).toBe('quarter')
  })

  it('orders the rows Off Duty, Sleeper Berth, Driving, On Duty', () => {
    const ys = ['OFF_DUTY', 'SLEEPER_BERTH', 'DRIVING', 'ON_DUTY_NOT_DRIVING'].map(rowCenterY)
    expect(ys).toEqual([...ys].sort((a, b) => a - b))
  })
})

describe('dutyLine', () => {
  const segments = [
    { status: 'OFF_DUTY', start_minute: 0, end_minute: 360 },
    { status: 'DRIVING', start_minute: 360, end_minute: 540 },
    { status: 'ON_DUTY_NOT_DRIVING', start_minute: 540, end_minute: 600 },
    { status: 'OFF_DUTY', start_minute: 600, end_minute: 1440 },
  ]

  it('draws one horizontal stroke per segment at the right times and row', () => {
    const { horizontals } = dutyLine(segments)
    expect(horizontals).toHaveLength(4)
    expect(horizontals[1]).toEqual({
      status: 'DRIVING',
      x1: minuteToX(360),
      x2: minuteToX(540),
      y: rowCenterY('DRIVING'),
    })
    expect(horizontals[3].x2).toBe(GRID_RIGHT)
  })

  it('joins consecutive segments with vertical strokes at the change of status', () => {
    const { connectors } = dutyLine(segments)
    expect(connectors).toEqual([
      { x: minuteToX(360), y1: rowCenterY('OFF_DUTY'), y2: rowCenterY('DRIVING') },
      { x: minuteToX(540), y1: rowCenterY('DRIVING'), y2: rowCenterY('ON_DUTY_NOT_DRIVING') },
      { x: minuteToX(600), y1: rowCenterY('ON_DUTY_NOT_DRIVING'), y2: rowCenterY('OFF_DUTY') },
    ])
  })

  it('draws no connector between segments in the same row', () => {
    const { connectors } = dutyLine([
      { status: 'DRIVING', start_minute: 0, end_minute: 60 },
      { status: 'DRIVING', start_minute: 60, end_minute: 120 },
    ])
    expect(connectors).toEqual([])
  })
})

describe('formatLogHours', () => {
  it('formats minutes as H:MM', () => {
    expect(formatLogHours(75)).toBe('1:15')
    expect(formatLogHours(660)).toBe('11:00')
    expect(formatLogHours(1440)).toBe('24:00')
    expect(formatLogHours(0)).toBe('0:00')
  })

  it('always reconciles to 24:00 when the minutes add to a day', () => {
    const totals = [385, 360, 640, 55]
    expect(totals.reduce((a, b) => a + b, 0)).toBe(1440)
    const shown = totals.map(formatLogHours).map((text) => {
      const [h, m] = text.split(':').map(Number)
      return h * 60 + m
    })
    expect(shown.reduce((a, b) => a + b, 0)).toBe(1440)
  })
})

describe('dateParts', () => {
  it('splits an ISO date', () => {
    expect(dateParts('2026-10-08')).toEqual({ month: '10', day: '08', year: '2026' })
  })
})

describe('placeRemarkMarkers', () => {
  it('numbers markers from 1 and keeps well-spaced ones on the first level', () => {
    const markers = placeRemarkMarkers([{ minute: 0 }, { minute: 120 }, { minute: 480 }])
    expect(markers.map((m) => m.number)).toEqual([1, 2, 3])
    expect(markers.map((m) => m.level)).toEqual([0, 0, 0])
  })

  it('moves a crowded marker to the second level', () => {
    const markers = placeRemarkMarkers([{ minute: 600 }, { minute: 615 }, { minute: 700 }])
    expect(markers.map((m) => m.level)).toEqual([0, 1, 0])
  })
})
