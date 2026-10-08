const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

function parts(iso) {
  const match = ISO_PATTERN.exec(iso)
  if (!match) return null
  const [, year, month, day, hour, minute] = match.map(Number)
  return { year, month, day, hour, minute }
}

export function formatTime(iso) {
  const p = parts(iso)
  if (!p) return ''
  const suffix = p.hour >= 12 ? 'PM' : 'AM'
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12
  return `${hour12}:${String(p.minute).padStart(2, '0')} ${suffix}`
}

export function formatDate(isoOrDate, { weekday = true } = {}) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoOrDate)
  if (!match) return ''
  const [, year, month, day] = match.map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: weekday ? 'short' : undefined,
    month: 'short',
    day: 'numeric',
  })
}

export function formatDuration(totalMinutes) {
  const minutes = Math.round(totalMinutes)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} m`
  if (m === 0) return `${h} h`
  return `${h} h ${m} m`
}

export function formatHours(hours) {
  return formatDuration(hours * 60)
}

export function formatMiles(miles) {
  return `${Math.round(miles).toLocaleString('en-US')} mi`
}

export function formatMinuteOfDay(minute) {
  const hour = Math.floor(minute / 60) % 24
  return formatTime(`2000-01-01T${String(hour).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`)
}

function dayNumber(iso) {
  const p = parts(iso)
  return p ? Date.UTC(p.year, p.month - 1, p.day) / 86_400_000 : NaN
}

export function formatTimeRange(startIso, endIso) {
  const range = `${formatTime(startIso)} \u2013 ${formatTime(endIso)}`
  const days = dayNumber(endIso) - dayNumber(startIso)
  return days > 0 ? `${range} (+${days} d)` : range
}
