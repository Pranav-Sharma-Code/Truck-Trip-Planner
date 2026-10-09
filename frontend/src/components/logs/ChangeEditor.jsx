import { Eraser, Plus, RotateCcw, Trash2 } from 'lucide-react'

import { STATUS_LABELS, STATUS_ORDER, statusColor } from '../../lib/dutyStatus'
import { MINUTES_PER_DAY, changeProblems, minuteToTime, timeToMinute } from '../../lib/logEdit'
import Button from '../ui/Button'
import { inputClass } from '../ui/inputStyles'

const newId = () => Math.random().toString(36).slice(2, 10)

const byTime = (a, b) => a.minute - b.minute

/** The first free minute after the last change (an hour on, if there is room), for a new row. */
function nextFreeMinute(changes) {
  const taken = new Set(changes.map((change) => change.minute))
  let minute = Math.min(MINUTES_PER_DAY - 1, Math.max(...changes.map((change) => change.minute)) + 60)
  while (taken.has(minute) && minute > 0) minute -= 1
  return minute
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

/**
 * Edit one day of the log. Each row is a change of duty status ("at 06:00 on duty at Richmond, VA"); a status lasts
 * until the next row, so the day always runs midnight to midnight with nothing missing or overlapping.
 */
export default function ChangeEditor({ edit, onChange, onResetToPlan, onStartBlank }) {
  const { errors, warnings } = changeProblems(edit.changes)
  // Rows stay where they are while a time is being typed; they are put in time order when the field is left.
  const rows = edit.changes

  const setChanges = (next) => onChange({ changes: next })
  const patchRow = (id, patch) => setChanges(edit.changes.map((change) => (change.id === id ? { ...change, ...patch } : change)))
  const sortRows = () => setChanges([...edit.changes].sort(byTime))

  const setTime = (id, text) => {
    const minute = timeToMinute(text)
    if (minute !== null) patchRow(id, { minute })
  }
  const addRow = () =>
    setChanges(
      [...edit.changes, { id: newId(), minute: nextFreeMinute(edit.changes), status: 'OFF_DUTY', location: '', note: '' }].sort(byTime),
    )

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Each row is a change of duty status. A status lasts until the next row, and the last one until midnight. Times are
        the trip's own time. The sheet below redraws as you type.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Total miles driving today">
          <input
            type="number"
            min="0"
            step="0.1"
            inputMode="decimal"
            value={edit.miles}
            className={inputClass(false)}
            onChange={(event) => onChange({ miles: event.target.value })}
          />
        </Field>
        <Field label="From">
          <input type="text" value={edit.from} className={inputClass(false)} onChange={(event) => onChange({ from: event.target.value })} />
        </Field>
        <Field label="To">
          <input type="text" value={edit.to} className={inputClass(false)} onChange={(event) => onChange({ to: event.target.value })} />
        </Field>
      </div>

      <div>
        <div className="hidden gap-2 px-1 pb-1 text-xs font-medium text-muted md:grid md:grid-cols-[110px_190px_1fr_1fr_40px]">
          <span>Time</span>
          <span>Duty status</span>
          <span>Place (city, state)</span>
          <span>Note</span>
          <span />
        </div>

        <ul className="space-y-2">
          {rows.map((change, index) => {
            const first = change.minute === 0 && index === 0
            return (
              <li key={change.id}>
                <div
                  className="grid grid-cols-2 items-center gap-2 rounded-lg border border-line border-l-4 bg-surface p-2 md:grid-cols-[110px_190px_1fr_1fr_40px]"
                  style={{ borderLeftColor: statusColor(change.status) }}
                >
                  <input
                    type="time"
                    aria-label={`Time of change ${index + 1}`}
                    value={minuteToTime(change.minute)}
                    disabled={first}
                    aria-invalid={Boolean(errors[change.id])}
                    title={first ? 'The day always starts at 12:00 AM' : undefined}
                    className={inputClass(errors[change.id])}
                    onChange={(event) => setTime(change.id, event.target.value)}
                    onBlur={sortRows}
                  />
                  <select
                    aria-label={`Duty status of change ${index + 1}`}
                    value={change.status}
                    className={`${inputClass(false)} appearance-auto`}
                    onChange={(event) => patchRow(change.id, { status: event.target.value })}
                  >
                    {STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    aria-label={`Place of change ${index + 1}`}
                    placeholder="e.g. Richmond, VA"
                    value={change.location}
                    className={`${inputClass(false)} col-span-2 md:col-span-1`}
                    onChange={(event) => patchRow(change.id, { location: event.target.value })}
                  />
                  <input
                    type="text"
                    aria-label={`Note for change ${index + 1}`}
                    placeholder="e.g. fuel stop"
                    value={change.note}
                    className={`${inputClass(false)} col-span-2 md:col-span-1`}
                    onChange={(event) => patchRow(change.id, { note: event.target.value })}
                  />
                  <button
                    type="button"
                    aria-label={`Delete change ${index + 1}`}
                    disabled={first}
                    onClick={() => setChanges(edit.changes.filter((item) => item.id !== change.id))}
                    className="grid size-10 place-items-center justify-self-end rounded-lg text-muted transition hover:bg-surface-2 hover:text-danger disabled:cursor-not-allowed disabled:opacity-30 md:justify-self-center"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
                {errors[change.id] ? (
                  <p className="mt-1 px-1 text-xs text-danger">{errors[change.id]}</p>
                ) : (
                  warnings[change.id] && <p className="mt-1 px-1 text-xs text-muted">{warnings[change.id]}</p>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={Plus} onClick={addRow}>
          Add a change
        </Button>
        <Button variant="ghost" icon={RotateCcw} onClick={onResetToPlan}>
          Reset day to plan
        </Button>
        <Button variant="ghost" icon={Eraser} onClick={onStartBlank}>
          Start blank
        </Button>
      </div>
    </div>
  )
}
