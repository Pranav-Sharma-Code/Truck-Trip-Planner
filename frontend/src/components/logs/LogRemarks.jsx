import { formatMinuteOfDay } from '../../lib/format'
import { GRID_BOTTOM, placeRemarkMarkers } from '../../lib/logGeometry'
import { PAPER } from './paper'

export const REMARK_ROW_HEIGHT = 15
export const MIN_REMARK_ROWS = 4

export function remarkRowCount(remarks) {
  return Math.max(MIN_REMARK_ROWS, Math.ceil(remarks.length / 2))
}

// Top of the remarks list, below the numbered markers.
export const REMARKS_LIST_TOP = GRID_BOTTOM + 92

export default function LogRemarks({ remarks }) {
  const markers = placeRemarkMarkers(remarks)
  const rows = remarkRowCount(remarks)
  const column = Math.ceil(remarks.length / 2)

  return (
    <g>
      {markers.map(({ number, x, level }) => {
        const cy = GRID_BOTTOM + 18 + level * 18
        return (
          <g key={number}>
            <line x1={x} y1={GRID_BOTTOM} x2={x} y2={cy - 7} stroke={PAPER.line} strokeWidth="0.8" />
            <circle cx={x} cy={cy} r="7" fill={PAPER.bg} stroke={PAPER.ink} strokeWidth="0.9" />
            <text x={x} y={cy + 3.2} fontSize="8.5" fontWeight="bold" textAnchor="middle" fill={PAPER.ink}>
              {number}
            </text>
          </g>
        )
      })}

      <text x="20" y={GRID_BOTTOM + 70} fontSize="14" fontWeight="bold" fill={PAPER.ink}>
        Remarks
      </text>
      <line x1="20" y1={REMARKS_LIST_TOP - 10} x2="980" y2={REMARKS_LIST_TOP - 10} stroke={PAPER.faint} strokeWidth="0.8" />

      {remarks.map((remark, index) => {
        const col = index < column ? 0 : 1
        const row = index < column ? index : index - column
        return (
          <text
            key={index}
            x={col === 0 ? 24 : 504}
            y={REMARKS_LIST_TOP + row * REMARK_ROW_HEIGHT + 3}
            fontSize="10.5"
            fill={PAPER.ink}
          >
            <tspan fontWeight="bold">{index + 1}.</tspan> {formatMinuteOfDay(remark.minute)} {'–'}{' '}
            {remark.location ?? 'Location not recorded'}, {remark.note.toLowerCase()}
          </text>
        )
      })}
      {Array.from({ length: rows }, (_, row) => (
        <line
          key={row}
          x1="20"
          y1={REMARKS_LIST_TOP + row * REMARK_ROW_HEIGHT + 7}
          x2="980"
          y2={REMARKS_LIST_TOP + row * REMARK_ROW_HEIGHT + 7}
          stroke={PAPER.faint}
          strokeWidth="0.5"
        />
      ))}
    </g>
  )
}
