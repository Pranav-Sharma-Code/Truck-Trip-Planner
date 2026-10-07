import { useEffect, useRef } from 'react'

import { EVENT_TYPES, ruleLabel } from '../../lib/eventTypes'
import { formatDuration, formatMiles, formatTimeRange } from '../../lib/format'

export default function TimelineItem({ event, selected, scrollIntoView, onSelect }) {
  const ref = useRef(null)
  const { label, color, icon: Icon } = EVENT_TYPES[event.type]
  const isDrive = event.type === 'DRIVE'
  const rule = ruleLabel(event.rule)

  // A marker click selects the item without moving the map; bring the item into view instead.
  useEffect(() => {
    if (selected && scrollIntoView) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected, scrollIntoView])

  return (
    <li>
      <button
        ref={ref}
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(event.id)}
        className={`flex w-full gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
          selected ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-surface-2'
        }`}
      >
        <span
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full"
          style={{ color, backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
        >
          <Icon size={16} aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className={`text-sm ${isDrive ? 'font-medium' : 'font-semibold'} text-ink`}>
              {isDrive ? event.reason : label}
            </span>
            <span className="text-xs text-muted">{formatTimeRange(event.start, event.end)}</span>
          </span>

          <span className="mt-0.5 block text-xs text-muted">
            {formatDuration(event.duration_minutes)}
            {isDrive ? ` · ${formatMiles(event.end_mile - event.start_mile)}` : ` · ${event.location.label}`}
            {!isDrive && ` · mile ${Math.round(event.start_mile).toLocaleString('en-US')}`}
          </span>

          {!isDrive && (
            <span className="mt-1.5 block text-xs text-ink/80">
              {event.reason}
              {rule && <span className="ml-1.5 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{rule}</span>}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}
