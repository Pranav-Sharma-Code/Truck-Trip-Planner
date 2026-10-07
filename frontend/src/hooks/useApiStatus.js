import { useEffect, useState } from 'react'

import { checkHealth } from '../api/client'

const SLOW_AFTER_MS = 4000

/**
 * Pings the API when the page loads. Free hosting puts idle servers to sleep, so this also
 * wakes it while the user is still filling in the form.
 *
 * @returns {'checking'|'waking'|'online'|'offline'}
 */
export function useApiStatus() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    const controller = new AbortController()
    const slow = setTimeout(() => setStatus((current) => (current === 'checking' ? 'waking' : current)), SLOW_AFTER_MS)

    checkHealth({ signal: controller.signal, timeoutMs: 90_000 })
      .then(() => setStatus('online'))
      .catch((error) => {
        if (!controller.signal.aborted) setStatus('offline')
        return error
      })
      .finally(() => clearTimeout(slow))

    return () => {
      controller.abort()
      clearTimeout(slow)
    }
  }, [])

  return status
}
