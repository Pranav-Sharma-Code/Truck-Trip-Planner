import { useCallback, useEffect, useRef, useState } from 'react'

import { planTrip } from '../api/client'

const IDLE = { status: 'idle', plan: null, error: null }

export function usePlanTrip() {
  const [state, setState] = useState(IDLE)
  const controller = useRef(null)

  useEffect(() => () => controller.current?.abort(), [])

  const run = useCallback(async (request) => {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current

    setState((previous) => ({ status: 'loading', plan: previous.plan, error: null }))
    try {
      const plan = await planTrip(request, { signal: current.signal })
      if (!current.signal.aborted) setState({ status: 'success', plan, error: null })
    } catch (error) {
      if (!current.signal.aborted) setState({ status: 'error', plan: null, error })
    }
  }, [])

  return { ...state, run }
}
