import { dateParts } from '../../lib/logGeometry'
import { Field, Lines, PAPER } from './paper'

export default function LogHeader({ log, details }) {
  const { month, day, year } = dateParts(log.date)
  const miles = log.total_miles ? String(Math.round(log.total_miles)) : '0'

  return (
    <g>
      <text x="20" y="34" fontSize="26" fontWeight="bold" fill={PAPER.ink}>
        Drivers Daily Log
      </text>
      <text x="20" y="50" fontSize="10" fill={PAPER.line}>
        (24 hours)
      </text>

      <Field x1="330" x2="380" y="36" value={month} caption="(month)" align="middle" size={14} />
      <text x="387" y="36" fontSize="16" fill={PAPER.ink}>/</text>
      <Field x1="396" x2="446" y="36" value={day} caption="(day)" align="middle" size={14} />
      <text x="453" y="36" fontSize="16" fill={PAPER.ink}>/</text>
      <Field x1="462" x2="532" y="36" value={year} caption="(year)" align="middle" size={14} />

      <Lines
        x="640"
        y="22"
        size="9"
        gap="12"
        lines={['Original - File at home terminal.', 'Duplicate - Driver retains in his/her possession for 8 days.']}
      />

      <text x="20" y="84" fontSize="13" fontWeight="bold" fill={PAPER.ink}>From:</text>
      <Field x1="62" x2="300" y="86" value={log.from_label} />
      <text x="320" y="84" fontSize="13" fontWeight="bold" fill={PAPER.ink}>To:</text>
      <Field x1="345" x2="600" y="86" value={log.to_label} />

      {[20, 170].map((x) => (
        <rect key={x} x={x} y="106" width="130" height="38" fill="none" stroke={PAPER.ink} strokeWidth="1" />
      ))}
      <text x="85" y="132" fontSize="18" fontWeight="bold" textAnchor="middle" fill={PAPER.ink}>{miles}</text>
      <text x="235" y="132" fontSize="18" fontWeight="bold" textAnchor="middle" fill={PAPER.ink}>{miles}</text>
      <text x="85" y="156" fontSize="8.5" textAnchor="middle" fill={PAPER.line}>Total Miles Driving Today</text>
      <text x="235" y="156" fontSize="8.5" textAnchor="middle" fill={PAPER.line}>Total Mileage Today</text>

      <Field x1="20" x2="300" y="192" value={details.vehicles} />
      <Lines
        x="160"
        y="203"
        size="8.5"
        gap="10"
        anchor="middle"
        fill={PAPER.line}
        lines={['Truck/Tractor and Trailer Numbers or', 'License Plate(s)/State (show each unit)']}
      />

      <Field x1="330" x2="980" y="128" value={details.carrier} caption="Name of Carrier or Carriers" align="middle" />
      <Field x1="330" x2="980" y="168" value={details.office} caption="Main Office Address" align="middle" />
      <Field x1="330" x2="980" y="208" value={details.terminal} caption="Home Terminal Address" align="middle" />
    </g>
  )
}
