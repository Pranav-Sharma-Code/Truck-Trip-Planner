import { Route } from 'lucide-react'
import { useState } from 'react'

import { useSlow } from '../../hooks/useSlow'
import { defaultStartValue } from '../../lib/startTime'
import { validateField, validateTrip } from '../../lib/validation'
import Button from '../ui/Button'
import { inputClass } from '../ui/inputStyles'
import CycleField from './CycleField'
import ExampleTrips from './ExampleTrips'
import LocationField from './LocationField'

const INITIAL_VALUES = () => ({
  current_location: '',
  pickup_location: '',
  dropoff_location: '',
  current_cycle_used_hours: '0',
  start_time: defaultStartValue(),
})

/**
 * `serverError` is the last ApiError and `submitted` the values it was for; a server message about
 * a field is shown only until that field is edited.
 */
export default function TripForm({ loading, serverError, submitted, onSubmit }) {
  const [values, setValues] = useState(INITIAL_VALUES)
  const [touched, setTouched] = useState({})
  const slow = useSlow(loading, 6000)

  const fieldError = (name) => {
    const local = touched[name] ? validateField(name, values[name]) : null
    if (local) return local
    const fromServer = serverError?.field === name && submitted?.[name] === values[name]
    return fromServer ? serverError.message : null
  }

  const change = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const blur = (name) => setTouched((current) => ({ ...current, [name]: true }))

  const pickExample = (example) => {
    setValues((current) => ({ ...current, ...example }))
    setTouched({})
  }

  const submit = (event) => {
    event.preventDefault()
    const errors = validateTrip(values)
    if (Object.keys(errors).length) {
      setTouched(Object.fromEntries(Object.keys(values).map((name) => [name, true])))
      document.getElementById(Object.keys(errors)[0])?.focus()
      return
    }
    onSubmit(values)
  }

  const shared = { onChange: change, onBlur: blur }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <ExampleTrips onPick={pickExample} disabled={loading} />

      <div className="space-y-4">
        <LocationField
          name="current_location"
          label="Current location"
          pin="A"
          placeholder="e.g. Dallas, TX"
          value={values.current_location}
          error={fieldError('current_location')}
          {...shared}
        />
        <LocationField
          name="pickup_location"
          label="Pickup location"
          pin="B"
          placeholder="e.g. Fort Worth, TX"
          value={values.pickup_location}
          error={fieldError('pickup_location')}
          {...shared}
        />
        <LocationField
          name="dropoff_location"
          label="Drop-off location"
          pin="C"
          placeholder="e.g. Austin, TX"
          value={values.dropoff_location}
          error={fieldError('dropoff_location')}
          {...shared}
        />
      </div>

      <CycleField value={values.current_cycle_used_hours} error={fieldError('current_cycle_used_hours')} {...shared} />

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
          onBlur={() => blur('start_time')}
        />
        <p className={`mt-1.5 text-xs ${fieldError('start_time') ? 'text-danger' : 'text-muted'}`}>
          {fieldError('start_time') || 'Your local time. The driver starts rested with full driving hours.'}
        </p>
      </div>

      <div>
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
