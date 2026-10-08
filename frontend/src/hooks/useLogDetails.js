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
    return EMPTY_DETAILS
  }
}

export function useLogDetails() {
  const [details, setDetails] = useState(load)

  const update = useCallback((name, value) => {
    setDetails((current) => {
      const next = { ...current, [name]: value }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
      }
      return next
    })
  }, [])

  return [details, update]
}
