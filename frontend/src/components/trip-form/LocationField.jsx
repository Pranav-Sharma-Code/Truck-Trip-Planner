import { inputClass } from '../ui/inputStyles'

// The pin letters match the order of the trip: A (current) to B (pickup) to C (drop-off).
export default function LocationField({ name, label, pin, value, error, placeholder, onChange, onBlur }) {
  const errorId = `${name}-error`
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink">
        <span
          aria-hidden="true"
          className="grid size-5 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-ink"
        >
          {pin}
        </span>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={inputClass(error)}
        onChange={(event) => onChange(name, event.target.value)}
        onBlur={() => onBlur(name)}
      />
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
