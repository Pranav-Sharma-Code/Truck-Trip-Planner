import { CheckCircle2, GitCompareArrows, TriangleAlert } from 'lucide-react'

import { formatMinuteOfDay } from '../../lib/format'
import { STATUS_LABELS, STATUS_ORDER, statusColor } from '../../lib/dutyStatus'
import { formatLogHours } from '../../lib/logGeometry'
import { formatDelta } from '../../lib/logEdit'
import Button from '../ui/Button'
import Spinner from '../ui/Spinner'

const dayNumber = (logs, date) => logs.findIndex((log) => log.date === date) + 1
const clock = (minute) => formatMinuteOfDay(minute % 1440)

function Delta({ minutes, unit }) {
  const changed = minutes !== 0 && !(unit === 'mi' && Math.abs(minutes) < 0.05)
  const text = unit === 'mi' ? `${minutes > 0 ? '+' : ''}${minutes.toFixed(1)} mi` : formatDelta(minutes)
  return <span className={changed ? 'font-semibold text-warn' : 'text-muted'}>{changed ? text : '–'}</span>
}

/** A rule problem in the edited logs, as "Day 2, 9:30 PM – 11:00 PM: message". */
function ViolationList({ violations, logs, showDay = true }) {
  return (
    <ul className="space-y-1 text-sm text-danger">
      {violations.map((violation, index) => (
        <li key={`${violation.code}-${violation.date}-${violation.start_minute}-${index}`}>
          {showDay && <strong className="font-semibold">Day {dayNumber(logs, violation.date)}, </strong>}
          {clock(violation.start_minute)} to {clock(violation.end_minute)}: {violation.message}
        </li>
      ))}
    </ul>
  )
}

/** The whole trip: how many days differ from the plan, by how much, and whether the edited logs still follow the rules. */
export function TripDeviation({ summary, check, logs, onResetAll }) {
  if (summary.daysChanged === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <CheckCircle2 size={16} className="text-ok" aria-hidden="true" />
        The logs match the plan. Use "Edit this day" to record what actually happened; every change is compared with the plan.
      </p>
    )
  }

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-4" aria-label="Deviation from the plan">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <GitCompareArrows size={16} className="text-muted" aria-hidden="true" />
            Differs from the plan on {summary.daysChanged} of {logs.length} {logs.length === 1 ? 'day' : 'days'}
          </h3>
          <p className="mt-1 text-xs text-muted">
            Driving <Delta minutes={summary.drivingDelta} /> · On duty <Delta minutes={summary.onDutyDelta} /> · Miles{' '}
            <Delta minutes={summary.milesDelta} unit="mi" /> · {formatLogHours(summary.minutesDifferent)} of the logged time differs
          </p>
        </div>
        <Button variant="ghost" onClick={onResetAll}>
          Reset all to plan
        </Button>
      </div>

      {check.status === 'checking' && (
        <p className="text-sm text-muted">
          <Spinner size={14} label="Checking the edited logs against the rules…" />
        </p>
      )}
      {check.status === 'error' && (
        <p className="flex items-center gap-2 text-sm text-warn">
          <TriangleAlert size={16} aria-hidden="true" />
          Could not check the edited logs against the hours-of-service rules just now (the server did not answer).
        </p>
      )}
      {check.status === 'done' && check.violations.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-ok">
          <CheckCircle2 size={16} aria-hidden="true" />
          The edited logs still follow the hours-of-service limits.
        </p>
      )}
      {check.status === 'done' && check.violations.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-danger">
            <TriangleAlert size={16} aria-hidden="true" />
            The edits break {check.violations.length} {check.violations.length === 1 ? 'rule' : 'rules'}
          </p>
          <ViolationList violations={check.violations} logs={logs} />
        </div>
      )}
    </section>
  )
}

/** One day: planned and actual hours side by side, where the two differ, and any rule problems on that day. */
export function DayDeviation({ planned, actual, comparison, violations }) {
  if (!comparison.changed) return null

  return (
    <section className="space-y-3 rounded-xl border border-warn-line bg-warn-soft p-4 text-ink" aria-label="This day compared with the plan">
      <h3 className="text-sm font-semibold">This day compared with the plan</h3>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="py-1 pr-3 font-medium">Duty status</th>
              <th className="py-1 pr-3 font-medium">Planned</th>
              <th className="py-1 pr-3 font-medium">Actual</th>
              <th className="py-1 font-medium">Difference</th>
            </tr>
          </thead>
          <tbody>
            {STATUS_ORDER.map((status) => (
              <tr key={status} className="border-t border-line/60">
                <td className="py-1.5 pr-3">
                  <span className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ backgroundColor: statusColor(status) }} />
                  {STATUS_LABELS[status]}
                </td>
                <td className="py-1.5 pr-3 tabular-nums">{formatLogHours(planned.totals_minutes[status])}</td>
                <td className="py-1.5 pr-3 tabular-nums">{formatLogHours(actual.totals_minutes[status])}</td>
                <td className="py-1.5 tabular-nums">
                  <Delta minutes={comparison.totalsDelta[status]} />
                </td>
              </tr>
            ))}
            <tr className="border-t border-line/60">
              <td className="py-1.5 pr-3">Miles driving</td>
              <td className="py-1.5 pr-3 tabular-nums">{planned.total_miles.toFixed(1)}</td>
              <td className="py-1.5 pr-3 tabular-nums">{actual.total_miles.toFixed(1)}</td>
              <td className="py-1.5 tabular-nums">
                <Delta minutes={comparison.milesDelta} unit="mi" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {comparison.intervals.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Where it differs</h4>
          <ul className="space-y-1 text-sm">
            {comparison.intervals.map((interval) => (
              <li key={`${interval.start}-${interval.actual}`}>
                {clock(interval.start)} to {clock(interval.end)} ({formatLogHours(interval.end - interval.start)}): planned{' '}
                <strong className="font-semibold">{STATUS_LABELS[interval.planned]}</strong>, logged{' '}
                <strong className="font-semibold">{STATUS_LABELS[interval.actual]}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {comparison.placeChanges.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Places that changed</h4>
          <ul className="space-y-1 text-sm">
            {comparison.placeChanges.map((change) => (
              <li key={change.minute}>
                {clock(change.minute)}: planned {change.planned}, logged {change.actual}
              </li>
            ))}
          </ul>
        </div>
      )}

      {violations.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-danger">Rule problems on this day</h4>
          <ViolationList violations={violations} logs={[planned]} showDay={false} />
        </div>
      )}
    </section>
  )
}
