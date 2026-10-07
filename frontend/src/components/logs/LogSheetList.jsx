import { Printer } from 'lucide-react'
import { useState } from 'react'

import { useLogDetails } from '../../hooks/useLogDetails'
import { usePrinting } from '../../hooks/usePrinting'
import { formatDate } from '../../lib/format'
import Button from '../ui/Button'
import LogDetailsForm from './LogDetailsForm'
import LogSheet from './LogSheet'

/** All of a trip's daily logs: one visible at a time on screen, every sheet on its own page when printed. */
export default function LogSheetList({ logs }) {
  const [details, updateDetail] = useLogDetails()
  const [active, setActive] = useState(0)
  const printing = usePrinting()
  const current = Math.min(active, logs.length - 1)

  return (
    <div className="space-y-4">
      <div className="space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Log sheets" className="flex flex-wrap gap-2">
            {logs.map((log, index) => (
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
              </button>
            ))}
          </div>
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
            Print or save as PDF
          </Button>
        </div>
        <p className="text-xs text-muted">
          Printing includes all {logs.length} {logs.length === 1 ? 'sheet' : 'sheets'}, one per page. Choose "Save as PDF" in the
          print dialog to keep a copy.
        </p>
        <LogDetailsForm details={details} onChange={updateDetail} />
      </div>

      {logs.map((log, index) => {
        // Only the visible sheet is drawn on screen; the others are mounted just for printing.
        if (index !== current && !printing) return null
        return (
          <div key={log.date} className={index === current ? 'block' : 'hidden print:block'}>
            <div className="log-sheet mx-auto max-w-[900px] overflow-hidden rounded-lg border border-line bg-white shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
              <LogSheet log={log} details={details} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
