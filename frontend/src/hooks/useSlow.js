import { useEffect, useState } from 'react'

/** True once `active` has stayed true for `delayMs`; used to change loading copy for slow requests. */
export function useSlow(active, delayMs) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!active) return undefined
    const timer = setTimeout(() => setSlow(true), delayMs)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [active, delayMs])

  return active && slow
}
