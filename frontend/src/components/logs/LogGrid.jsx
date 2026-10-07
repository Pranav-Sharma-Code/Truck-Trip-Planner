import { STATUS_LABELS, STATUS_ORDER } from '../../lib/dutyStatus'
import {
  GRID,
  GRID_BOTTOM,
  GRID_RIGHT,
  GRID_WIDTH,
  HOUR_LABELS,
  dutyLine,
  formatLogHours,
  gridTicks,
  rowCenterY,
  rowTop,
} from '../../lib/logGeometry'
import { PAPER } from './paper'

const TICK_HEIGHT = { hour: GRID.rowHeight, half: 14, quarter: 8 }
const ROW_NUMBERS = { OFF_DUTY: 1, SLEEPER_BERTH: 2, DRIVING: 3, ON_DUTY_NOT_DRIVING: 4 }
const TOTAL_X = GRID_RIGHT + 14

export default function LogGrid({ log }) {
  const { horizontals, connectors } = dutyLine(log.segments)
  const ticks = gridTicks()

  return (
    <g>
      {/* hour labels above the grid */}
      {HOUR_LABELS.map((label, hour) => {
        const x = GRID.x + hour * GRID.hourWidth
        return label === 'Mid-night' ? (
          <text key={hour} x={x} fontSize="8.5" textAnchor="middle" fill={PAPER.ink}>
            <tspan x={x} y={GRID.y - 18}>Mid-</tspan>
            <tspan x={x} y={GRID.y - 8}>night</tspan>
          </text>
        ) : (
          <text key={hour} x={x} y={GRID.y - 8} fontSize="9.5" textAnchor="middle" fill={PAPER.ink}>
            {label}
          </text>
        )
      })}
      <text x={TOTAL_X + 52} y={GRID.y - 18} fontSize="9" fontWeight="bold" textAnchor="middle" fill={PAPER.ink}>
        Total
      </text>
      <text x={TOTAL_X + 52} y={GRID.y - 8} fontSize="9" fontWeight="bold" textAnchor="middle" fill={PAPER.ink}>
        Hours
      </text>

      {/* frame and row separators */}
      <rect x={GRID.x} y={GRID.y} width={GRID_WIDTH} height={GRID_BOTTOM - GRID.y} fill="none" stroke={PAPER.ink} strokeWidth="1.2" />
      {STATUS_ORDER.slice(1).map((status) => (
        <line key={status} x1={GRID.x} y1={rowTop(status)} x2={GRID_RIGHT} y2={rowTop(status)} stroke={PAPER.ink} strokeWidth="0.8" />
      ))}

      {/* 15-minute ticks, drawn up from the bottom of each row; one path per row and tick size */}
      {STATUS_ORDER.map((status) =>
        ['quarter', 'half', 'hour'].map((kind) => {
          const bottom = rowTop(status) + GRID.rowHeight
          const d = ticks
            .filter((tick) => tick.kind === kind)
            .map((tick) => `M${tick.x} ${bottom}V${bottom - TICK_HEIGHT[kind]}`)
            .join('')
          return (
            <path
              key={`${status}-${kind}`}
              d={d}
              stroke={kind === 'hour' ? PAPER.line : PAPER.faint}
              strokeWidth={kind === 'hour' ? 0.8 : 0.7}
            />
          )
        }),
      )}

      {/* row labels and totals */}
      {STATUS_ORDER.map((status) => (
        <g key={status}>
          <text x={GRID.x - 8} y={rowCenterY(status) + 4} fontSize="12" textAnchor="end" fill={PAPER.ink}>
            {ROW_NUMBERS[status]}. {STATUS_LABELS[status].replace(' (not driving)', '')}
          </text>
          {status === 'ON_DUTY_NOT_DRIVING' && (
            <text x={GRID.x - 8} y={rowCenterY(status) + 16} fontSize="9" textAnchor="end" fill={PAPER.line}>
              (not driving)
            </text>
          )}
          <text x={TOTAL_X + 90} y={rowCenterY(status) + 5} fontSize="13" textAnchor="end" fill={PAPER.ink}>
            {formatLogHours(log.totals_minutes[status])}
          </text>
          <line x1={TOTAL_X} y1={rowTop(status) + GRID.rowHeight - 6} x2={TOTAL_X + 90} y2={rowTop(status) + GRID.rowHeight - 6} stroke={PAPER.ink} strokeWidth="0.8" />
        </g>
      ))}
      <text x={TOTAL_X + 90} y={GRID_BOTTOM + 18} fontSize="13" fontWeight="bold" textAnchor="end" fill={PAPER.ink}>
        = {formatLogHours(STATUS_ORDER.reduce((sum, status) => sum + log.totals_minutes[status], 0))}
      </text>

      {/* the duty line */}
      <g stroke={PAPER.ink} strokeWidth="3" strokeLinecap="square" fill="none" data-testid="duty-line">
        {horizontals.map((h, index) => (
          <line key={`h${index}`} x1={h.x1} y1={h.y} x2={h.x2} y2={h.y} data-status={h.status} />
        ))}
        {connectors.map((c, index) => (
          <line key={`c${index}`} x1={c.x} y1={c.y1} x2={c.x} y2={c.y2} strokeWidth="2" />
        ))}
      </g>
    </g>
  )
}
