import { describe, expect, it } from 'vitest'

import { parsePreference, resolveTheme } from './theme'

describe('parsePreference', () => {
  it('keeps an explicit light or dark choice', () => {
    expect(parsePreference('light')).toBe('light')
    expect(parsePreference('dark')).toBe('dark')
  })

  it('treats anything else as system', () => {
    expect(parsePreference(null)).toBe('system')
    expect(parsePreference('')).toBe('system')
    expect(parsePreference('sepia')).toBe('system')
    expect(parsePreference('system')).toBe('system')
  })
})

describe('resolveTheme', () => {
  it('uses the explicit choice whatever the device prefers', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('follows the device setting for system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})
