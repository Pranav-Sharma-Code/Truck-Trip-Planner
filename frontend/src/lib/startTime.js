const pad = (n) => String(n).padStart(2, '0')

/** Value for a datetime-local input: now, rounded up to the next quarter hour, in local time. */
export function defaultStartValue(now = new Date()) {
  const rounded = new Date(now)
  rounded.setSeconds(0, 0)
  rounded.setMinutes(Math.ceil(rounded.getMinutes() / 15) * 15)
  return `${rounded.getFullYear()}-${pad(rounded.getMonth() + 1)}-${pad(rounded.getDate())}T${pad(rounded.getHours())}:${pad(rounded.getMinutes())}`
}

/**
 * 'YYYY-MM-DDTHH:mm' (local time) to an ISO timestamp with the local UTC offset, which is what
 * the API needs. Returns null if the value is not a real date and time.
 */
export function toIsoWithOffset(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number)

  const local = new Date(year, month - 1, day, hour, minute)
  const valid =
    local.getFullYear() === year &&
    local.getMonth() === month - 1 &&
    local.getDate() === day &&
    local.getHours() === hour &&
    local.getMinutes() === minute
  if (!valid) return null

  const offset = -local.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return `${value}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}
