export const PAPER = {
  bg: '#ffffff',
  ink: '#121826',
  line: '#3b4252',
  faint: '#aab2c0',
  font: 'Arial, Helvetica, sans-serif',
}

/** Several lines of small text; `lines` is an array of strings. */
export function Lines({ x, y, lines, size = 9, gap = 11, anchor = 'start', weight = 'normal', fill = PAPER.ink }) {
  return (
    <text x={x} y={y} fontSize={size} textAnchor={anchor} fontWeight={weight} fill={fill}>
      {lines.map((line, index) => (
        <tspan key={line} x={x} dy={index === 0 ? 0 : gap}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

export function Field({ x1: left, x2: right, y: baseline, value, caption, align = 'start', size = 12 }) {
  // Positions arrive as numbers or numeric strings; do the arithmetic on numbers.
  const [x1, x2, y] = [Number(left), Number(right), Number(baseline)]
  const textX = align === 'middle' ? (x1 + x2) / 2 : x1 + 4
  return (
    <g>
      {value && (
        <text x={textX} y={y - 4} fontSize={size} textAnchor={align} fill={PAPER.ink}>
          {value}
        </text>
      )}
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={PAPER.ink} strokeWidth="0.8" />
      {caption && (
        <text x={(x1 + x2) / 2} y={y + 11} fontSize="8.5" textAnchor="middle" fill={PAPER.line}>
          {caption}
        </text>
      )}
    </g>
  )
}
