import { Pencil, Printer, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useLogCheck } from '../../hooks/useLogCheck'
import { useLogDetails } from '../../hooks/useLogDetails'
import { useLogEdits } from '../../hooks/useLogEdits'
import { usePrinting } from '../../hooks/usePrinting'
import { formatDate } from '../../lib/format'
import Button from '../ui/Button'
import Card from '../ui/Card'
import ChangeEditor from './ChangeEditor'
import { DayDeviation, TripDeviation } from './DeviationPanel'
import LogDetailsForm from './LogDetailsForm'
import LogSheet from './LogSheet'

const offsetOf = (iso) => /([+-]\d{2}:\d{2})$/.exec(iso)?.[1] ?? '+00:00'

/**
 * The trip's daily logs. Each day starts as the planner drew it and can be edited, filled in by hand from a blank
 * day, or reset. Every difference from the plan is tracked, and edited logs are checked against the HOS rules.
 * One sheet shows on screen; every sheet is drawn, one per page, when printing.
 */
export default function LogSheetList({ plan }) {
  const planned = plan.daily_logs
  const planKey = `${plan.summary.start}|${plan.summary.arrival}|${plan.summary.total_miles}`

  const [details, updateDetail] = useLogDetails()
  const edits = useLogEdits(planKey, planned)
  const printing = usePrinting()
  const [active, setActive] = useState(0)
  const [editing, setEditing] = useState(false)
  const [showPlanned, setShowPlanned] = useState(true)

  const current = Math.min(active, planned.length - 1)
  const date = planned[current].date
  const edit = edits.edits[date]
  const comparison = edits.comparisons[current]
  const hasEdits = edits.summary.daysChanged > 0

  const checkDays = useMemo(() => edits.actual.map((log) => ({ date: log.date, segments: log.segments })), [edits.actual])
  const check = useLogCheck({
    enabled: hasEdits,
    days: checkDays,
    utcOffset: offsetOf(plan.summary.start),
    cycleUsedStartHours: plan.summary.cycle_used_start_hours,
  })
  const dayViolations = check.violations.filter((violation) => violation.date === date)

  const openEditor = () => {
    edits.startEditing(date)
    setEditing(true)
  }
  const resetDay = () => {
    edits.resetDay(date)
    edits.startEditing(date)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 print:hidden">
        <TripDeviation summary={edits.summary} check={check} logs={planned} onResetAll={edits.resetAll} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Log sheets" className="flex flex-wrap gap-2">
            {planned.map((log, index) => {
              const changed = edits.comparisons[index].changed
              return (
                <button
                  key={log.date}
                  type="button"
                  role="tab"
                  aria-selected={index === current}
                  onClick={() => setActive(index)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    index === current
                      ? 'border-accent bg-accent-soft text-ink'
                      : 'border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink'
                  }`}
                >
                  Day {index + 1} <span className="font-normal">{formatDate(log.date, { weekday: false })}</span>
                  {changed && (
                    <span className="ml-1.5 text-warn" title="Differs from the plan" aria-label="differs from the plan">
                      ●
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
            Print or save as PDF
          </Button>
        </div>
        <p className="text-xs text-muted">
          Printing includes all {planned.length} {planned.length === 1 ? 'sheet' : 'sheets'}, one per page, as logged (edits included).
          Choose "Save as PDF" in the print dialog to keep a copy.
        </p>
        <LogDetailsForm details={details} onChange={updateDetail} />

        {editing && edit ? (
          <Card
            title={`Edit the log for Day ${current + 1}`}
            icon={Pencil}
            action={
              <Button variant="ghost" icon={X} onClick={() => setEditing(false)}>
                Close editor
              </Button>
            }
          >
            <ChangeEditor
              edit={edit}
              onChange={(patch) => edits.update(date, patch)}
              onResetToPlan={resetDay}
              onStartBlank={() => edits.startBlank(date)}
            />
          </Card>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" icon={Pencil} onClick={openEditor}>
              Edit this day
            </Button>
            <span className="text-xs text-muted">Change times, statuses and places, or fill the day in by hand.</span>
          </div>
        )}

        <DayDeviation planned={planned[current]} actual={edits.actual[current]} comparison={comparison} violations={dayViolations} />

        {comparison.changed && (
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={showPlanned} onChange={(event) => setShowPlanned(event.target.checked)} />
            Show the plan as a dashed orange line on the sheet (not printed)
          </label>
        )}
      </div>

      {planned.map((log, index) => {
        // Only the visible sheet is drawn on screen; the others are mounted just for printing.
        if (index !== current && !printing) return null
        const changed = edits.comparisons[index].changed
        return (
          <div key={log.date} className={index === current ? 'block' : 'hidden print:block'}>
            <div className="log-sheet mx-auto max-w-[900px] overflow-hidden rounded-lg border border-line bg-white shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
              <LogSheet log={edits.actual[index]} details={details} plannedSegments={changed && showPlanned ? log.segments : undefined} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
