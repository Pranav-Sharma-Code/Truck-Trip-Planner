import { describe, expect, it } from 'vitest'

import { COMMON_COUNTRIES, countryName, countryOptions, detailsLabel, getProfile, postalError } from './countries'
import { composeQuery, effectiveCountry, emptyLocation, hasDetails } from './locations'
import { REGIONS } from './regions'

describe('countries', () => {
  it('names countries from their ISO code', () => {
    expect(countryName('IN')).toBe('India')
    expect(countryName('AE')).toBe('United Arab Emirates')
    expect(countryName('')).toBe('')
  })

  it('lists the common countries first and every country once, sorted by name', () => {
    const { common, all } = countryOptions()
    expect(common.map((c) => c.code)).toEqual(COMMON_COUNTRIES)
    expect(all.length).toBeGreaterThan(200)
    expect(new Set(all.map((c) => c.code)).size).toBe(all.length)
    const names = all.map((c) => c.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(all.find((c) => c.code === 'IN').name).toBe('India')
  })
})

describe('country profiles change the labels', () => {
  it('uses Indian terms for India', () => {
    const india = getProfile('IN')
    expect(india.regionLabel).toBe('State / UT')
    expect(india.areaLabel).toBe('District')
    expect(india.postal.label).toBe('PIN code')
    expect(india.regions).toContain('Maharashtra')
    expect(india.regions).toHaveLength(36)
  })

  it('uses US terms for the US', () => {
    const us = getProfile('US')
    expect([us.regionLabel, us.areaLabel, us.postal.label]).toEqual(['State', 'County', 'ZIP code'])
    expect(us.regions).toHaveLength(51)
  })

  it('falls back to generic labels and a free-text region for other countries', () => {
    const france = getProfile('FR')
    expect(france.regionLabel).toBe('State / province / region')
    expect(france.postal.label).toBe('Postal code')
    expect(france.regions).toBeNull()
    expect(getProfile('').postal.label).toBe('Postal code')
  })

  it('hides the postal field for countries without postal codes', () => {
    expect(getProfile('AE').postal).toBeNull()
    expect(getProfile('QA').postal).toBeNull()
  })

  it('builds the button text from the labels', () => {
    expect(detailsLabel('IN')).toBe('Add state, district & PIN code')
    expect(detailsLabel('US')).toBe('Add state, county & ZIP code')
    expect(detailsLabel('AE')).toBe('Add emirate & area')
    expect(detailsLabel('')).toBe('Add region, district & postal code')
  })

  it('has unique, non-empty region lists', () => {
    for (const [code, regions] of Object.entries(REGIONS)) {
      expect(regions.length, code).toBeGreaterThan(3)
      expect(new Set(regions).size, code).toBe(regions.length)
    }
  })
})

describe('postalError', () => {
  it('validates by country', () => {
    expect(postalError('IN', '411001')).toBeNull()
    expect(postalError('IN', '4110')).toMatch(/PIN code/)
    expect(postalError('GB', 'SW1A 1AA')).toBeNull()
    expect(postalError('GB', '12345')).toMatch(/Postcode/)
    expect(postalError('CA', 'M5V 2T6')).toBeNull()
    expect(postalError('AU', '2000')).toBeNull()
    expect(postalError('DE', '10115')).toBeNull()
  })

  it('does not complain about empty values or countries without a rule', () => {
    expect(postalError('IN', '  ')).toBeNull()
    expect(postalError('FR', 'whatever')).toBeNull()
    expect(postalError('', 'whatever')).toBeNull()
  })
})

describe('locations', () => {
  it('joins the filled parts, most specific first', () => {
    const location = { ...emptyLocation(), place: 'Pune', region: 'Maharashtra', postal: '411001' }
    expect(composeQuery(location)).toBe('Pune, Maharashtra, 411001')
    expect(composeQuery(emptyLocation())).toBe('')
  })

  it('prefers the place country over the trip country', () => {
    expect(effectiveCountry({ country: 'US' }, 'IN')).toBe('US')
    expect(effectiveCountry({ country: '' }, 'IN')).toBe('IN')
    expect(effectiveCountry({ country: '' }, '')).toBe('')
  })

  it('knows when extra details are filled in', () => {
    expect(hasDetails(emptyLocation())).toBe(false)
    expect(hasDetails({ ...emptyLocation(), place: 'Pune' })).toBe(false)
    expect(hasDetails({ ...emptyLocation(), postal: '411001' })).toBe(true)
  })
})
