// The user can pick Light, Dark, or System (follow the operating system). Only an explicit
// Light or Dark is stored; System means "nothing stored".
export const THEME_STORAGE_KEY = 'hos-theme'
export const THEME_CHOICES = ['light', 'dark', 'system']

/** Anything that is not a known explicit choice counts as System. */
export function parsePreference(value) {
  return value === 'light' || value === 'dark' ? value : 'system'
}

/** The theme actually shown, given the choice and whether the OS prefers dark. */
export function resolveTheme(preference, systemPrefersDark) {
  if (preference === 'light' || preference === 'dark') return preference
  return systemPrefersDark ? 'dark' : 'light'
}
