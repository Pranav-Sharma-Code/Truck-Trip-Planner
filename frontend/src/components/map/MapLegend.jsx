import { EVENT_TYPES, MARKER_TYPES, START_MARKER } from '../../lib/eventTypes'

function Swatch({ color, children }) {
  return (
    <span
      className="grid size-5 place-items-center rounded-full text-[10px] font-bold text-[var(--marker-ink)]"
      style={{ backgroundColor: color }}
    >
      {children}
    </span>
  )
}

export default function MapLegend({ present }) {
  const types = MARKER_TYPES.filter((type) => present.has(type))
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Map legend">
      <li className="flex items-center gap-1.5">
        <Swatch color={START_MARKER.color}>{START_MARKER.pin}</Swatch>
        Start
      </li>
      {types.map((type) => {
        const { label, color, icon: Icon, pin } = EVENT_TYPES[type]
        return (
          <li key={type} className="flex items-center gap-1.5">
            <Swatch color={color}>{pin ?? <Icon size={11} strokeWidth={2.6} aria-hidden="true" />}</Swatch>
            {label}
          </li>
        )
      })}
    </ul>
  )
}
