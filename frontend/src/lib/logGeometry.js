import { STATUS_ORDER } from './dutyStatus'

// Layout of one log sheet, in SVG units. The grid follows the FMCSA graph grid: 24 hours across
// (midnight to midnight) and four duty-status rows.
export const SHEET_WIDTH = 1000
export const MINUTES_PER_DAY = 24 * 60

export const GRID = {
  x: 150,
  y: 262,
  hourWidth: 30,
  rowHeight: 38,
}

export const GRID_WIDTH = 24 * GRID.hourWidth
export const GRID_HEIGHT = STATUS_ORDER.length * GRID.rowHeight
export const GRID_RIGHT = GRID.x + GRID_WIDTH
export const GRID_BOTTOM = GRID.y + GRID_HEIGHT

export const HOUR_LABELS = [
  'Mid-night',
  ...Array.from({ length: 11 }, (_, i) => String(i + 1)),
  'Noon',
  ...Array.from({ length: 11 }, (_, i) => String(i + 1)),
  'Mid-night',
]

export const minuteToX = (minute) => GRID.x + (minute / MINUTES_PER_DAY) * GRID_WIDTH

export const rowTop = (status) => GRID.y + STATUS_ORDER.indexOf(status) * GRID.rowHeight
export const rowCenterY = (status) => rowTop(status) + GRID.rowHeight / 2

/** Vertical lines for the grid: every 15 minutes, with hour, half-hour and quarter-hour sizes. */
export function gridTicks() {
  return Array.from({ length: 24 * 4 + 1 }, (_, i) => ({
    x: GRID.x + (i * GRID.hourWidth) / 4,
    kind: i % 4 === 0 ? 'hour' : i % 2 === 0 ? 'half' : 'quarter',
  }))
}

/**
 * The duty line as the driver would draw it: one horizontal stroke per segment, joined by vertical
 * strokes where the status changes.
 */
export function dutyLine(segments) {
  const horizontals = segments.map((segment) => ({
    status: segment.status,
    x1: minuteToX(segment.start_minute),
    x2: minuteToX(segment.end_minute),
    y: rowCenterY(segment.status),
  }))

  const connectors = []
  for (let i = 1; i < segments.length; i += 1) {
    const before = horizontals[i - 1]
    const after = horizontals[i]
    if (before.y !== after.y) connectors.push({ x: after.x1, y1: before.y, y2: after.y })
  }
  return { horizontals, connectors }
}

/** Minutes as H:MM, which always adds up exactly (24:00 for a full day). */
export function formatLogHours(minutes) {
  const total = Math.round(minutes)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Splits 'YYYY-MM-DD' into the month, day and year written at the top of the sheet. */
export function dateParts(isoDate) {
  const [year, month, day] = isoDate.split('-')
  return { month, day, year }
}

const LEVEL_SPACING = 16

/**
 * Numbered remark markers under the grid. Markers that would overlap sit on a second level so
 * every number stays readable.
 */
export function placeRemarkMarkers(remarks) {
  let previous = null
  return remarks.map((remark, index) => {
    const x = minuteToX(remark.minute)
    const crowded = previous && x - previous.x < LEVEL_SPACING
    const level = crowded ? (previous.level + 1) % 2 : 0
    previous = { x, level }
    return { number: index + 1, x, level, remark }
  })
}
