import { ChevronDown } from 'lucide-react'

import { inputClass } from '../ui/inputStyles'

const FIELDS = [
  { name: 'driver', label: "Driver's name", placeholder: 'Printed under the signature line' },
  { name: 'carrier', label: 'Name of carrier', placeholder: 'e.g. Example Freight LLC' },
  { name: 'office', label: 'Main office address', placeholder: 'City and state are enough' },
  { name: 'terminal', label: 'Home terminal address', placeholder: 'City and state are enough' },
  { name: 'vehicles', label: 'Truck / tractor and trailer numbers', placeholder: 'Or license plate and state' },
  { name: 'manifest', label: 'DVL or manifest number', placeholder: '' },
  { name: 'shipper', label: 'Shipper and commodity', placeholder: 'e.g. Acme Foods, packaged goods' },
]

export default function LogDetailsForm({ details, onChange }) {
  return (
    <details className="group rounded-lg border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink">
        <span>
          Sheet details
          <span className="ml-2 text-xs font-normal text-muted">carrier, vehicle, shipment (saved in this browser)</span>
        </span>
        <ChevronDown size={16} className="text-muted transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
        {FIELDS.map(({ name, label, placeholder }) => (
          <div key={name}>
            <label htmlFor={`log-${name}`} className="mb-1 block text-xs font-medium text-muted">
              {label}
            </label>
            <input
              id={`log-${name}`}
              type="text"
              value={details[name]}
              placeholder={placeholder}
              maxLength={120}
              autoComplete="off"
              className={inputClass(false)}
              onChange={(event) => onChange(name, event.target.value)}
            />
          </div>
        ))}
      </div>
    </details>
  )
}
