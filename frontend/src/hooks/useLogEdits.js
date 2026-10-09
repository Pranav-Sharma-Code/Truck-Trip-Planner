import { useCallback, useEffect, useMemo, useState } from 'react'

import { applyEdits, blankEdit, compareDay, editFromLog, summarizeComparisons } from '../lib/logEdit'

const STORAGE_KEY = 'hos-log-edits'

// Only the edits for the trip on screen are kept, so a new plan never inherits another trip's edits.
function load(planKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return saved?.planKey === planKey && saved.edits ? saved.edits : {}
  } catch {
    return {}
  }
}

function save(planKey, edits) {
  try {
    if (Object.keys(edits).length) localStorage.setItem(STORAGE_KEY, JSON.stringify({ planKey, edits }))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage can be blocked; the edits still work for this visit.
  }
}

/**
 * The driver's edits to a trip's daily logs, kept in this browser. `planned` is what the planner produced;
 * `actual` is what the sheets show: the planned day, or the edited one.
 */
export function useLogEdits(planKey, planned) {
  const [edits, setEdits] = useState(() => load(planKey))

  useEffect(() => save(planKey, edits), [planKey, edits])

  const actual = useMemo(() => applyEdits(planned, edits), [planned, edits])
  const comparisons = useMemo(() => planned.map((log, index) => compareDay(log, actual[index])), [planned, actual])
  const summary = useMemo(() => summarizeComparisons(comparisons), [comparisons])

  const plannedFor = useCallback((date) => planned.find((log) => log.date === date), [planned])

  const startEditing = useCallback(
    (date) => setEdits((current) => (current[date] ? current : { ...current, [date]: editFromLog(plannedFor(date)) })),
    [plannedFor],
  )
  const startBlank = useCallback((date) => setEdits((current) => ({ ...current, [date]: blankEdit() })), [])
  const update = useCallback(
    (date, patch) => setEdits((current) => ({ ...current, [date]: { ...current[date], ...patch } })),
    [],
  )
  const resetDay = useCallback(
    (date) =>
      setEdits((current) => {
        const { [date]: removed, ...rest } = current // eslint-disable-line no-unused-vars
        return rest
      }),
    [],
  )
  const resetAll = useCallback(() => setEdits({}), [])

  return { edits, actual, comparisons, summary, startEditing, startBlank, update, resetDay, resetAll }
}
