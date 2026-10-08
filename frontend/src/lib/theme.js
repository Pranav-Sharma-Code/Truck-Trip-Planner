// The user can pick Light, Dark, or System (follow the operating system). Only an explicit
// Light or Dark is stored; System means "nothing stored".
export const THEME_STORAGE_KEY = 'hos-theme'
export const THEME_CHOICES = ['light', 'dark', 'system']

export function parsePreference(value) {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function resolveTheme(preference, systemPrefersDark) {
  if (preference === 'light' || preference === 'dark') return preference
  return systemPrefersDark ? 'dark' : 'light'
}
