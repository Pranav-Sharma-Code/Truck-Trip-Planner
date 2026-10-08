import { REGIONS } from './regions'

// ISO 3166-1 alpha-2 codes. Names come from the browser (Intl.DisplayNames), so they are
// localised and never go out of date.
const ALL_CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO ' +
  'FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE ' +
  'JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO ' +
  'MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW ' +
  'PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM ' +
  'TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'

export const COMMON_COUNTRIES = ['US', 'IN', 'CA', 'GB', 'AU', 'AE']

let displayNames
export function countryName(code) {
  if (!code) return ''
  try {
    displayNames ??= new Intl.DisplayNames(['en'], { type: 'region' })
    return displayNames.of(code) ?? code
  } catch {
    return code
  }
}

let options
/** `{ common, all }`, each a list of `{ code, name }` sorted by name. Built once. */
export function countryOptions() {
  if (!options) {
    const all = ALL_CODES.split(' ')
      .map((code) => ({ code, name: countryName(code) }))
      .filter((country) => country.name !== country.code)
      .sort((a, b) => a.name.localeCompare(b.name))
    options = {
      common: COMMON_COUNTRIES.map((code) => ({ code, name: countryName(code) })),
      all,
    }
  }
  return options
}

// What each part of an address is called depends on the country. A `null` postal profile means the
// country has no postal code system, so the field is hidden.
const DEFAULT_PROFILE = {
  regionLabel: 'State / province / region',
  regionShort: 'region',
  areaLabel: 'District / county',
  areaShort: 'district',
  placeHint: 'City, town or address',
  examples: ['Dallas, TX', 'Fort Worth, TX', 'Austin, TX'],
  postal: { label: 'Postal code', short: 'postal code', pattern: null, example: '' },
}

const PROFILES = {
  IN: {
    regionLabel: 'State / UT',
    regionShort: 'state',
    areaLabel: 'District',
    areaShort: 'district',
    placeHint: 'City, town or village',
    examples: ['Mumbai', 'Pune', 'Bengaluru'],
    postal: { label: 'PIN code', short: 'PIN code', pattern: /^[1-9]\d{5}$/, example: '411001' },
  },
  US: {
    regionLabel: 'State',
    regionShort: 'state',
    areaLabel: 'County',
    areaShort: 'county',
    placeHint: 'City or address',
    examples: ['Dallas', 'Fort Worth', 'Austin'],
    postal: { label: 'ZIP code', short: 'ZIP code', pattern: /^\d{5}(-\d{4})?$/, example: '75201' },
  },
  CA: {
    regionLabel: 'Province / territory',
    regionShort: 'province',
    areaLabel: 'Municipality',
    areaShort: 'municipality',
    placeHint: 'City or address',
    examples: ['Toronto', 'Ottawa', 'Montreal'],
    postal: { label: 'Postal code', short: 'postal code', pattern: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, example: 'M5V 2T6' },
  },
  GB: {
    regionLabel: 'Nation',
    regionShort: 'nation',
    areaLabel: 'County',
    areaShort: 'county',
    placeHint: 'Town, city or address',
    examples: ['London', 'Birmingham', 'Manchester'],
    postal: { label: 'Postcode', short: 'postcode', pattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/, example: 'SW1A 1AA' },
  },
  AU: {
    regionLabel: 'State / territory',
    regionShort: 'state',
    areaLabel: 'Suburb / local area',
    areaShort: 'suburb',
    placeHint: 'City, suburb or address',
    examples: ['Sydney', 'Canberra', 'Melbourne'],
    postal: { label: 'Postcode', short: 'postcode', pattern: /^\d{4}$/, example: '2000' },
  },
  AE: {
    regionLabel: 'Emirate',
    regionShort: 'emirate',
    areaLabel: 'Area / community',
    areaShort: 'area',
    placeHint: 'City or area',
    examples: ['Dubai', 'Abu Dhabi', 'Sharjah'],
    postal: null, // the UAE does not use postal codes
  },
  DE: {
    regionLabel: 'State (Bundesland)',
    regionShort: 'state',
    areaLabel: 'District (Kreis)',
    areaShort: 'district',
    placeHint: 'City, town or address',
    examples: ['Berlin', 'Leipzig', 'Munich'],
    postal: { label: 'Postleitzahl (PLZ)', short: 'postal code', pattern: /^\d{5}$/, example: '10115' },
  },
  MX: {
    regionLabel: 'State (Estado)',
    regionShort: 'state',
    areaLabel: 'Municipality',
    areaShort: 'municipality',
    placeHint: 'City, town or address',
    examples: ['Mexico City', 'Puebla', 'Guadalajara'],
    postal: { label: 'Código postal', short: 'postal code', pattern: /^\d{5}$/, example: '06000' },
  },
  QA: { postal: null },
  HK: { postal: null },
}

/** Field labels, pick list and postal rule for a country code ('' means no country chosen). */
export function getProfile(code) {
  return { ...DEFAULT_PROFILE, ...PROFILES[code], regions: REGIONS[code] ?? null, code: code || '' }
}

/** Error message for a postal code, or null if it is empty or fine for this country. */
export function postalError(code, value) {
  const text = value.trim()
  const { postal } = getProfile(code)
  if (!text || !postal?.pattern) return null
  if (postal.pattern.test(text)) return null
  return `Enter a valid ${postal.label}, for example ${postal.example}`
}

/** "Add state, district & PIN code": the button text that opens the extra address fields. */
export function detailsLabel(code) {
  const { regionShort, areaShort, postal } = getProfile(code)
  const parts = [regionShort, areaShort, postal?.short].filter(Boolean)
  const last = parts.pop()
  return `Add ${parts.length ? `${parts.join(', ')} & ` : ''}${last}`
}
