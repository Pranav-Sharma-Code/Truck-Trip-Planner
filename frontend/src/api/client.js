const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

const PLAN_TIMEOUT_MS = 120_000

export class ApiError extends Error {
  constructor({ message, code = 'error', field = null, status = 0 }) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.field = field
    this.status = status
  }
}

async function request(path, { timeoutMs = 30_000, signal, ...options } = {}) {
  const timeout = AbortSignal.timeout(timeoutMs)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response
  try {
    response = await fetch(BASE_URL + path, { ...options, signal: combined })
  } catch (error) {
    if (signal?.aborted) throw error
    if (timeout.aborted) {
      throw new ApiError({
        code: 'timeout',
        message: 'The server took too long to respond. Please try again.',
      })
    }
    throw new ApiError({
      code: 'network_error',
      message: "Can't reach the server. Check your connection and try again.",
    })
  }

  let body = null
  try {
    body = await response.json()
  } catch {
  }

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: body?.code,
      field: body?.field,
      message: body?.message || 'Something went wrong planning this trip.',
    })
  }
  return body
}

export function checkHealth(options) {
  return request('/api/health/', options)
}

/**
 * Checks edited daily logs against the hours-of-service rules.
 * @param {{utc_offset: string, cycle_used_start_hours: number, days: {date: string, segments: object[]}[]}} logs
 * @returns {Promise<{ok: boolean, violations: {code: string, message: string, date: string, start_minute: number, end_minute: number}[]}>}
 */
export function checkLogs(logs, { signal } = {}) {
  return request('/api/logs/check/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logs),
    signal,
  })
}

/**
 * @param {import('./types').TripRequest} trip
 * @returns {Promise<import('./types').TripPlan>}
 */
export function planTrip(trip, { signal } = {}) {
  return request('/api/trips/plan/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trip),
    timeoutMs: PLAN_TIMEOUT_MS,
    signal,
  })
}
