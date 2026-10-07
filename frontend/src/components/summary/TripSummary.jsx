import { CheckCircle2, XCircle } from 'lucide-react'

import { formatDate, formatHours, formatMiles, formatTime } from '../../lib/format'
import Card from '../ui/Card'

const CYCLE_LIMIT_HOURS = 70

function Stat({ label, value, sub }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-2 px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold leading-tight text-ink">{value}</dd>
      {sub && <dd className="mt-0.5 text-xs text-muted">{sub}</dd>}
    </div>
  )
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export default function TripSummary({ plan }) {
  const { summary, compliance } = plan
  const stopCounts = [
    [summary.fuel_stops, 'fuel stop'],
    [summary.breaks, 'break'],
    [summary.rests, 'rest'],
    [summary.restarts, 'restart'],
  ].filter(([count]) => count > 0)
  const stopTotal = stopCounts.reduce((sum, [count]) => sum + count, 0)

  return (
    <Card
      title="Trip summary"
      action={
        compliance.ok ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-ok">
            <CheckCircle2 size={14} aria-hidden="true" />
            Within HOS limits
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-danger">
            <XCircle size={14} aria-hidden="true" />
            {plural(compliance.violations.length, 'rule problem')}
          </span>
        )
      }
    >
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Distance" value={formatMiles(summary.total_miles)} sub={`${formatHours(summary.driving_hours)} driving`} />
        <Stat
          label="Trip duration"
          value={formatHours(summary.trip_hours)}
          sub={`Arrive ${formatDate(summary.arrival)}, ${formatTime(summary.arrival)}`}
        />
        <Stat label="Log sheets" value={summary.log_sheets} sub={summary.log_sheets === 1 ? 'one day' : 'days on the road'} />
        <Stat
          label="Cycle used"
          value={`${formatHours(summary.cycle_used_start_hours)} → ${formatHours(summary.cycle_used_end_hours)}`}
          sub={summary.restarts ? 'restart reset the cycle' : `of ${CYCLE_LIMIT_HOURS} h`}
        />
        <Stat label="Cycle left" value={formatHours(summary.cycle_available_end_hours)} sub="after drop-off" />
        <Stat
          label="Stops"
          value={stopTotal ? plural(stopTotal, 'stop') : 'None needed'}
          sub={stopCounts.map(([count, word]) => plural(count, word)).join(' · ') || undefined}
        />
      </dl>
    </Card>
  )
}
