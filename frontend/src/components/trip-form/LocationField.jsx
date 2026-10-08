import { ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { countryName, detailsLabel, getProfile } from '../../lib/countries'
import { LOCATION_KEYS, effectiveCountry, hasDetails } from '../../lib/locations'
import { inputClass } from '../ui/inputStyles'
import CountrySelect from './CountrySelect'

const PINS = { current: 'A', pickup: 'B', dropoff: 'C' }

function Labelled({ id, label, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  )
}

/**
 * One place on the trip. The main box takes a city, town or address; the "Add ..." panel adds a
 * country, state, district and postal code. Their names, the state list and the postal-code rule
 * follow the country, so for India it asks for State / UT, District and PIN code.
 */
export default function LocationField({ locKey, label, value, tripCountry, placeError, postalError, onChange, onBlur }) {
  const [userOpen, setUserOpen] = useState(null) // null: open by itself whenever something is filled in
  const code = effectiveCountry(value, tripCountry)
  const profile = getProfile(code)
  const open = userOpen ?? hasDetails(value)
  const showPanel = open || Boolean(postalError)

  const placeId = `${locKey}_location`
  const postalId = `${locKey}_postal`
  const example = profile.examples[LOCATION_KEYS.indexOf(locKey)]
  const summary = [value.region, value.area, value.postal, value.country && countryName(value.country)].filter(Boolean).join(' · ')

  return (
    <div>
      <label htmlFor={placeId} className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink">
        <span
          aria-hidden="true"
          className="grid size-5 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-ink"
        >
          {PINS[locKey]}
        </span>
        {label}
      </label>
      <input
        id={placeId}
        name={placeId}
        type="text"
        value={value.place}
        placeholder={`${profile.placeHint}, e.g. ${example}`}
        autoComplete="off"
        aria-invalid={Boolean(placeError)}
        aria-describedby={placeError ? `${placeId}-error` : undefined}
        className={inputClass(placeError)}
        onChange={(event) => onChange(locKey, { place: event.target.value })}
        onBlur={() => onBlur(placeId)}
      />
      {placeError && (
        <p id={`${placeId}-error`} className="mt-1.5 text-xs text-danger">
          {placeError}
        </p>
      )}

      <button
        type="button"
        aria-expanded={showPanel}
        aria-controls={`${locKey}-details`}
        onClick={() => setUserOpen(!showPanel)}
        className="mt-1.5 flex w-full items-center gap-1 rounded text-left text-xs font-medium text-accent hover:underline"
      >
        <ChevronRight size={14} className={`shrink-0 transition ${showPanel ? 'rotate-90' : ''}`} aria-hidden="true" />
        <span className="shrink-0">{detailsLabel(code)}</span>
        {!showPanel && summary && <span className="truncate font-normal text-muted">· {summary}</span>}
      </button>

      {showPanel && (
        <div id={`${locKey}-details`} className="mt-2 grid gap-3 rounded-lg border border-line bg-surface-2 p-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Labelled id={`${locKey}_country`} label="Country">
              <CountrySelect
                id={`${locKey}_country`}
                value={value.country}
                onChange={(next) => onChange(locKey, { country: next })}
                emptyLabel={tripCountry ? `Same as trip (${countryName(tripCountry)})` : 'Anywhere'}
              />
            </Labelled>
          </div>

          <Labelled id={`${locKey}_region`} label={profile.regionLabel}>
            {profile.regions ? (
              <select
                id={`${locKey}_region`}
                value={value.region}
                className={`${inputClass(false)} appearance-auto`}
                onChange={(event) => onChange(locKey, { region: event.target.value })}
              >
                <option value="">Any {profile.regionShort}</option>
                {profile.regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`${locKey}_region`}
                type="text"
                value={value.region}
                autoComplete="off"
                className={inputClass(false)}
                onChange={(event) => onChange(locKey, { region: event.target.value })}
              />
            )}
          </Labelled>

          <Labelled id={`${locKey}_area`} label={profile.areaLabel}>
            <input
              id={`${locKey}_area`}
              type="text"
              value={value.area}
              autoComplete="off"
              className={inputClass(false)}
              onChange={(event) => onChange(locKey, { area: event.target.value })}
            />
          </Labelled>

          {profile.postal ? (
            <Labelled
              id={postalId}
              label={profile.postal.label}
              hint={postalError ? null : profile.postal.example && `e.g. ${profile.postal.example}`}
            >
              <input
                id={postalId}
                type="text"
                inputMode={/^\d+$/.test(profile.postal.example) ? 'numeric' : 'text'}
                value={value.postal}
                autoComplete="off"
                aria-invalid={Boolean(postalError)}
                aria-describedby={postalError ? `${postalId}-error` : undefined}
                className={inputClass(postalError)}
                onChange={(event) => onChange(locKey, { postal: event.target.value })}
                onBlur={() => onBlur(postalId)}
              />
              {postalError && (
                <p id={`${postalId}-error`} className="mt-1 text-xs text-danger">
                  {postalError}
                </p>
              )}
            </Labelled>
          ) : (
            <p className="self-end pb-2 text-[11px] text-muted">{countryName(code)} does not use postal codes.</p>
          )}
        </div>
      )}
    </div>
  )
}
