import { CheckCircle2, ListChecks, XCircle } from 'lucide-react'

import { EVENT_TYPES } from '../../lib/eventTypes'
import { formatDate, formatDuration, formatTime } from '../../lib/format'
import Card from '../ui/Card'

// Limits as the clock counts them (minutes, miles). A cell turns amber when its counter is at the limit.
const COLUMNS = [
  { key: 'driving_minutes_in_shift', label: 'Driving since rest', limit: 11 * 60, show: (v) => `${formatDuration(v)} / 11 h` },
  { key: 'window_elapsed_minutes', label: '14-hour window', limit: 14 * 60, show: (v) => `${formatDuration(v)} / 14 h` },
  { key: 'driving_minutes_since_break', label: 'Since break', limit: 8 * 60, show: (v) => `${formatDuration(v)} / 8 h` },
  { key: 'cycle_used_minutes', label: 'Cycle used', limit: 70 * 60, show: (v) => `${formatDuration(v)} / 70 h` },
  { key: 'miles_since_fuel', label: 'Since fuel', limit: 1000, show: (v) => `${Math.round(v)} / 1,000 mi` },
]

export default function AuditPanel({ plan }) {
  const { compliance, assumptions, events } = plan

  return (
    <div className="space-y-4">
      <Card
        title="Rule check"
        icon={ListChecks}
        action={
          compliance.ok ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-ok">
              <CheckCircle2 size={14} aria-hidden="true" />
              No violations
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-danger">
              <XCircle size={14} aria-hidden="true" />
              {compliance.violations.length} found
            </span>
          )
        }
      >
        <p className="text-sm text-muted">
          After the plan is built, a separate checker re-reads it from scratch and tests the 11-hour driving limit, the
          14-hour window, the 30-minute break after 8 hours of driving, the 70-hour cycle and the 1,000-mile fuel
          interval. The table shows the counters after each event.
        </p>
        {!compliance.ok && (
          <ul className="mt-3 space-y-1 text-sm text-danger">
            {compliance.violations.map((violation) => (
              <li key={`${violation.code}-${violation.event_id}`}>
                Event {violation.event_id}: {violation.message}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Counters after each event" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Start</th>
                <th className="px-3 py-2 font-medium">Length</th>
                {COLUMNS.map((column) => (
                  <th key={column.key} className="px-3 py-2 font-medium">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-line/60 last:border-0">
                  <td className="px-3 py-2 text-muted">{event.id}</td>
                  <td className="px-3 py-2 font-medium text-ink">{EVENT_TYPES[event.type].label}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">
                    {formatDate(event.start, { weekday: false })}, {formatTime(event.start)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{formatDuration(event.duration_minutes)}</td>
                  {COLUMNS.map((column) => {
                    const value = event.clocks_after[column.key]
                    const atLimit = value >= column.limit
                    return (
                      <td key={column.key} className={`whitespace-nowrap px-3 py-2 ${atLimit ? 'font-semibold text-warn' : 'text-ink'}`}>
                        {column.show(value)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Assumptions behind this plan">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
          {assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
