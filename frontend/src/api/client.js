const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

// Planning can take a while on a cold server, so this is generous.
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
    // Non-JSON error pages (proxy errors, etc.) fall through to the generic message below.
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
