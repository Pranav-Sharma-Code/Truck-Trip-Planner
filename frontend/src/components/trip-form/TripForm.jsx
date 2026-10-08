import { Route } from 'lucide-react'
import { useState } from 'react'

import { useSlow } from '../../hooks/useSlow'
import { countryName } from '../../lib/countries'
import { LOCATION_KEYS, emptyLocation, emptyLocations } from '../../lib/locations'
import { defaultStartValue } from '../../lib/startTime'
import { placeName, postalName, toRequest, validateField, validateTrip } from '../../lib/validation'
import Button from '../ui/Button'
import { inputClass } from '../ui/inputStyles'
import CountrySelect from './CountrySelect'
import CycleField from './CycleField'
import ExampleTrips from './ExampleTrips'
import LocationField from './LocationField'

const LABELS = { current: 'Current location', pickup: 'Pickup location', dropoff: 'Drop-off location' }

const INITIAL_VALUES = () => ({
  country: '', 
  ...emptyLocations(),
  current_cycle_used_hours: '0',
  start_time: defaultStartValue(),
})

const DETAILS_CLEARED = { region: '', area: '', postal: '' }

export default function TripForm({ loading, serverError, submitted, onSubmit }) {
  const [values, setValues] = useState(INITIAL_VALUES)
  const [touched, setTouched] = useState({})
  const slow = useSlow(loading, 6000)
  const request = toRequest(values)

  const fieldError = (name) => {
    const local = touched[name] ? validateField(name, values) : null
    if (local) return local
    const fromServer = serverError?.field === name && submitted?.[name] === request[name]
    return fromServer ? serverError.message : null
  }

  const touch = (name) => setTouched((current) => ({ ...current, [name]: true }))
  const change = (name, value) => setValues((current) => ({ ...current, [name]: value }))

  const changeCountry = (code) =>
    setValues((current) => {
      const next = { ...current, country: code }
      for (const key of LOCATION_KEYS) {
        if (!current[key].country) next[key] = { ...current[key], ...DETAILS_CLEARED }
      }
      return next
    })

  const changeLocation = (key, patch) =>
    setValues((current) => {
      const location = { ...current[key], ...patch }
      if ('country' in patch) Object.assign(location, DETAILS_CLEARED)
      return { ...current, [key]: location }
    })

  const pickExample = (example) => {
    setValues((current) => ({
      ...current,
      country: example.country ?? '',
      current: { ...emptyLocation(), ...example.current },
      pickup: { ...emptyLocation(), ...example.pickup },
      dropoff: { ...emptyLocation(), ...example.dropoff },
      current_cycle_used_hours: example.current_cycle_used_hours,
    }))
    setTouched({})
  }

  const submit = (event) => {
    event.preventDefault()
    const errors = validateTrip(values)
    const names = Object.keys(errors)
    if (names.length) {
      setTouched(Object.fromEntries(names.map((name) => [name, true])))
      // The postal field may be inside a panel that is about to open, so focus after the next render.
      requestAnimationFrame(() => document.getElementById(names[0])?.focus())
      return
    }
    onSubmit(values)
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <ExampleTrips onPick={pickExample} disabled={loading} />

      <div>
        <label htmlFor="trip_country" className="mb-1.5 block text-sm font-medium text-ink">
          Country
        </label>
        <CountrySelect
          id="trip_country"
          value={values.country}
          onChange={changeCountry}
          emptyLabel="Anywhere (search worldwide)"
        />
        <p className="mt-1.5 text-xs text-muted">
          {values.country
            ? `Searches stay inside ${countryName(values.country)}, and the address fields below use its terms.`
            : 'Pick a country to narrow the search. For a trip across a border, leave it and set a country on each place.'}
        </p>
      </div>

      <div className="space-y-4">
        {LOCATION_KEYS.map((key) => (
          <LocationField
            key={key}
            locKey={key}
            label={LABELS[key]}
            value={values[key]}
            tripCountry={values.country}
            placeError={fieldError(placeName(key))}
            postalError={fieldError(postalName(key))}
            onChange={changeLocation}
            onBlur={touch}
          />
        ))}
      </div>

      <CycleField
        value={values.current_cycle_used_hours}
        error={fieldError('current_cycle_used_hours')}
        onChange={change}
        onBlur={touch}
      />

      <div>
        <label htmlFor="start_time" className="mb-1.5 block text-sm font-medium text-ink">
          Start time
        </label>
        <input
          id="start_time"
          name="start_time"
          type="datetime-local"
          value={values.start_time}
          aria-invalid={Boolean(fieldError('start_time'))}
          className={inputClass(fieldError('start_time'))}
          onChange={(event) => change('start_time', event.target.value)}
          onBlur={() => touch('start_time')}
        />
        <p className={`mt-1.5 text-xs ${fieldError('start_time') ? 'text-danger' : 'text-muted'}`}>
          {fieldError('start_time') || 'Your local time. The driver starts rested with full driving hours.'}
        </p>
      </div>

      {/* Pinned to the bottom of the panel (or the screen on a phone) so the submit button is always in view. */}
      <div className="sticky bottom-0 -mx-5 -mb-5 rounded-b-xl border-t border-line bg-surface px-5 py-3">
        <Button type="submit" loading={loading} icon={Route} className="w-full">
          {loading ? 'Planning trip…' : 'Plan trip'}
        </Button>
        {slow && (
          <p role="status" className="mt-2 text-center text-xs text-muted">
            Still working. The server may be waking up, which can take up to a minute.
          </p>
        )}
      </div>
    </form>
  )
}
