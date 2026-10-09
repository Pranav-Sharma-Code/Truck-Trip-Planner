import { formatDate } from '../../lib/format'
import { SHEET_WIDTH } from '../../lib/logGeometry'
import LogFooter, { FOOTER_HEIGHT } from './LogFooter'
import LogGrid from './LogGrid'
import LogHeader from './LogHeader'
import LogRemarks, { REMARK_ROW_HEIGHT, REMARKS_LIST_TOP, remarkRowCount } from './LogRemarks'
import { PAPER } from './paper'

/** One day's Driver's Daily Log, drawn as SVG so it stays sharp when printed. */
export default function LogSheet({ log, details, plannedSegments }) {
  const footerTop = REMARKS_LIST_TOP + remarkRowCount(log.remarks) * REMARK_ROW_HEIGHT + 24
  const height = footerTop + FOOTER_HEIGHT
  const label = `Driver's daily log for ${formatDate(log.date)}`

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${SHEET_WIDTH} ${height}`}
      className="block h-auto w-full"
      fontFamily={PAPER.font}
    >
      <title>{label}</title>
      <rect width={SHEET_WIDTH} height={height} fill={PAPER.bg} />
      <LogHeader log={log} details={details} />
      <LogGrid log={log} plannedSegments={plannedSegments} />
      <LogRemarks remarks={log.remarks} />
      <LogFooter log={log} details={details} top={footerTop} />
    </svg>
  )
}
