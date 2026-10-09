import { useEffect, useState } from 'react'

import { checkLogs } from '../api/client'

const DEBOUNCE_MS = 600

/**
 * Asks the server whether the edited logs still follow the hours-of-service rules. Only runs while some day
 * differs from the plan (an unchanged plan is already known to be legal), and waits a moment after the last
 * edit so typing does not send a request per keystroke.
 *
 * @returns {{status: 'idle'|'checking'|'done'|'error', violations: object[]}}
 */
export function useLogCheck({ enabled, days, utcOffset, cycleUsedStartHours }) {
  const [state, setState] = useState({ status: 'idle', violations: [] })
  const key = JSON.stringify({ days, utcOffset, cycleUsedStartHours })

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', violations: [] })
      return undefined
    }
    const controller = new AbortController()
    setState((current) => ({ ...current, status: 'checking' }))

    const timer = setTimeout(() => {
      checkLogs(
        { utc_offset: utcOffset, cycle_used_start_hours: cycleUsedStartHours, days },
        { signal: controller.signal },
      )
        .then((result) => setState({ status: 'done', violations: result.violations }))
        .catch(() => {
          if (!controller.signal.aborted) setState({ status: 'error', violations: [] })
        })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // `key` stands for days, utcOffset and cycleUsedStartHours together.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key])

  return state
}
