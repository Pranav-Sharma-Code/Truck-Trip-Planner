import { EVENT_TYPES, MARKER_TYPES, START_MARKER } from './eventTypes'
import { formatDuration, formatTimeRange } from './format'

export const START_ID = 'start'

export function buildMarkers(plan) {
  const start = plan.locations.current
  const markers = [
    {
      id: START_ID,
      type: 'START',
      position: [start.lat, start.lon],
      title: START_MARKER.label,
      detail: start.label.replace(/, USA$/, ''),
      reason: 'Where the trip begins.',
    },
  ]

  for (const event of plan.events) {
    if (!MARKER_TYPES.includes(event.type)) continue
    markers.push({
      id: event.id,
      type: event.type,
      position: [event.location.lat, event.location.lon],
      title: EVENT_TYPES[event.type].label,
      time: `${formatTimeRange(event.start, event.end)} · ${formatDuration(event.duration_minutes)}`,
      detail: event.location.label,
      reason: event.reason,
    })
  }
  return markers
}

export function groupEventsByDay(events) {
  const days = []
  for (const event of events) {
    const date = event.start.slice(0, 10)
    const last = days[days.length - 1]
    if (last?.date === date) last.events.push(event)
    else days.push({ date, number: days.length + 1, events: [event] })
  }
  return days
}

export function eventBounds(event) {
  return [
    [event.location.lat, event.location.lon],
    [event.end_location.lat, event.end_location.lon],
  ]
}
