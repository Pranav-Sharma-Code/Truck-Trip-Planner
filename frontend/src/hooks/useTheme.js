import { useCallback, useEffect, useState } from 'react'

import { THEME_STORAGE_KEY, parsePreference, resolveTheme } from '../lib/theme'

const QUERY = '(prefers-color-scheme: dark)'

function readStored() {
  try {
    return parsePreference(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system' 
  }
}

export function useTheme() {
  const [preference, setPreference] = useState(readStored)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const media = window.matchMedia(QUERY)
    const onChange = (event) => setSystemDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolved = resolveTheme(preference, systemDark)
  useEffect(() => {
    document.documentElement.dataset.theme = resolved
  }, [resolved])

  const choose = useCallback((next) => {
    setPreference(next)
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
      else localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      
    }
  }, [])

  return { preference, resolved, choose }
}
