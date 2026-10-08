import { countryOptions } from '../../lib/countries'
import { inputClass } from '../ui/inputStyles'

/** A country pick list: the most used countries first, then everyone else. `emptyLabel` is the "none" choice. */
export default function CountrySelect({ id, value, onChange, emptyLabel, ariaLabel }) {
  const { common, all } = countryOptions()
  return (
    <select
      id={id}
      value={value}
      aria-label={ariaLabel}
      className={`${inputClass(false)} appearance-auto`}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{emptyLabel}</option>
      <optgroup label="Common">
        {common.map(({ code, name }) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </optgroup>
      <optgroup label="All countries">
        {all.map(({ code, name }) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </optgroup>
    </select>
  )
}
