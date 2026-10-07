import { useCallback, useState } from 'react'

const STORAGE_KEY = 'hos-log-details'

export const EMPTY_DETAILS = {
  driver: '',
  carrier: '',
  office: '',
  terminal: '',
  vehicles: '',
  manifest: '',
  shipper: '',
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return { ...EMPTY_DETAILS, ...saved }
  } catch {
    // Storage can be blocked (private windows) or hold junk; start blank instead.
    return EMPTY_DETAILS
  }
}

/** Header details for the log sheets (carrier, vehicle, ...). Remembered in this browser only. */
export function useLogDetails() {
  const [details, setDetails] = useState(load)

  const update = useCallback((name, value) => {
    setDetails((current) => {
      const next = { ...current, [name]: value }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Not being able to save is fine; the sheets still use what is typed.
      }
      return next
    })
  }, [])

  return [details, update]
}
