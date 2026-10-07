import { formatHours } from '../../lib/format'
import { MAX_CYCLE_HOURS } from '../../lib/validation'
import { inputClass } from '../ui/inputStyles'

const NAME = 'current_cycle_used_hours'

export default function CycleField({ value, error, onChange, onBlur }) {
  const hours = Number(value)
  const usable = value.trim() !== '' && Number.isFinite(hours) && hours >= 0 && hours <= MAX_CYCLE_HOURS
  const errorId = `${NAME}-error`

  return (
    <div>
      <label htmlFor={NAME} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-ink">
        Current cycle used
        <span className="text-xs font-normal text-muted">70 hr / 8 day</span>
      </label>

      <div className="flex items-center gap-3">
        <div className="relative w-28 shrink-0">
          <input
            id={NAME}
            name={NAME}
            type="number"
            inputMode="decimal"
            min="0"
            max={MAX_CYCLE_HOURS}
            step="0.25"
            value={value}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={`${inputClass(error)} pr-9`}
            onChange={(event) => onChange(NAME, event.target.value)}
            onBlur={() => onBlur(NAME)}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted">hrs</span>
        </div>
        <input
          type="range"
          min="0"
          max={MAX_CYCLE_HOURS}
          step="0.5"
          value={usable ? hours : 0}
          aria-label="Cycle hours used, slider"
          className="h-2 flex-1 cursor-pointer accent-[var(--accent)]"
          onChange={(event) => onChange(NAME, event.target.value)}
        />
      </div>

      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-muted">
          {usable ? `${formatHours(MAX_CYCLE_HOURS - hours)} available before the trip` : 'Hours already worked in the last 8 days'}
        </p>
      )}
    </div>
  )
}
