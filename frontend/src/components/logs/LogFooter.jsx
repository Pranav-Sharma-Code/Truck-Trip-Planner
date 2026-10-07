import { formatLogHours } from '../../lib/logGeometry'
import { Field, Lines, PAPER } from './paper'

export const FOOTER_HEIGHT = 250

// A bordered box with a caption and a value, used for the recap figures.
function RecapBox({ x, width, caption, value }) {
  return (
    <g>
      <rect x={x} y="0" width={width} height="46" fill="none" stroke={PAPER.ink} strokeWidth="0.9" />
      <text x={x + width / 2} y="29" fontSize="17" fontWeight="bold" textAnchor="middle" fill={PAPER.ink}>
        {value}
      </text>
      <Lines x={x + width / 2} y="62" size="8" gap="9.5" anchor="middle" fill={PAPER.line} lines={caption} />
    </g>
  )
}

/** Shipping documents, the recap block and the signature line. `top` is the y of the footer. */
export default function LogFooter({ log, details, top }) {
  const { recap } = log
  const onDuty = formatLogHours(recap.on_duty_minutes_today)

  return (
    <g transform={`translate(0 ${top})`}>
      <text x="20" y="12" fontSize="13" fontWeight="bold" fill={PAPER.ink}>Shipping Documents:</text>
      <text x="20" y="38" fontSize="10.5" fill={PAPER.ink}>DVL or Manifest No.:</text>
      <Field x1="130" x2="470" y="40" value={details.manifest} />
      <text x="20" y="64" fontSize="10.5" fill={PAPER.ink}>Shipper &amp; Commodity:</text>
      <Field x1="130" x2="470" y="66" value={details.shipper} />

      <Lines
        x="500"
        y="12"
        size="9.5"
        gap="12"
        fill={PAPER.line}
        lines={[
          'Enter name of place you reported and where released from work and when',
          'and where each change of duty occurred. Use time standard of home terminal.',
        ]}
      />

      <g transform="translate(0 92)">
        <text x="20" y="-6" fontSize="11" fontWeight="bold" fill={PAPER.ink}>
          Recap (end of day)
        </text>
        <RecapBox x={20} width={150} value={onDuty} caption={['On duty hours today,', 'total lines 3 & 4']} />
        <text x="190" y="-6" fontSize="11" fontWeight="bold" fill={PAPER.ink}>
          70 Hour / 8 Day Drivers
        </text>
        <RecapBox
          x={190}
          width={170}
          value={formatLogHours(recap.cycle_used_minutes)}
          caption={['A. Total hours on duty last 8', 'days including today']}
        />
        <RecapBox
          x={380}
          width={170}
          value={formatLogHours(recap.cycle_available_minutes)}
          caption={['B. Total hours available', 'tomorrow (70 hr. minus A)*']}
        />
        <RecapBox x={570} width={150} value={'–'} caption={['C. Total hours on duty last 5', 'days (not tracked)']} />
        <Lines
          x="745"
          y="12"
          size="9"
          gap="11"
          fill={recap.restart_completed ? PAPER.ink : PAPER.line}
          weight={recap.restart_completed ? 'bold' : 'normal'}
          lines={[
            '*If you took 34 consecutive',
            'hours off duty you have',
            '70 hours available.',
            recap.restart_completed ? '34-hour restart completed today.' : '',
          ].filter(Boolean)}
        />
      </g>

      <Field x1="150" x2="520" y="212" value={details.driver} caption="Driver's signature in full" />
      <text x="545" y="205" fontSize="10" fill={PAPER.ink}>I certify that these entries are true and correct.</text>
    </g>
  )
}
