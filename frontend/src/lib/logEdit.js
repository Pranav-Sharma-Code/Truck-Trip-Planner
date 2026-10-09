// Editing a daily log, and comparing the edited ("actual") log with the planned one.
//
// A day is edited as a list of CHANGES: "at 06:00 the status became On Duty, at Richmond, VA". The first change is
// always at 00:00, and each change lasts until the next one (the last until midnight). That way a day can never
// have gaps or overlaps, and it always adds up to 24 hours, whatever is typed.

import { STATUS_LABELS, STATUS_ORDER } from './dutyStatus'

export const MINUTES_PER_DAY = 24 * 60
export const CYCLE_LIMIT_MINUTES = 70 * 60

const newId = () => Math.random().toString(36).slice(2, 10)
const round1 = (value) => Math.round(value * 10) / 10

// ---- times --------------------------------------------------------------------------------------------------------

/** Minutes after midnight to the "HH:MM" an <input type="time"> uses. */
export function minuteToTime(minute) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

/** "HH:MM" to minutes after midnight, or null if it is not a valid time. */
export function timeToMinute(text) {
  const match = /^(\d{2}):(\d{2})$/.exec(text ?? '')
  if (!match) return null
  const [hours, minutes] = [Number(match[1]), Number(match[2])]
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null
}

/** "+0:30", "-1:15" or "0:00": a difference in minutes, with its sign. */
export function formatDelta(minutes) {
  const total = Math.round(minutes)
  const sign = total > 0 ? '+' : total < 0 ? '-' : ''
  const abs = Math.abs(total)
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`
}

// ---- rows <-> segments --------------------------------------------------------------------------------------------

/** The planned log as editable change rows. */
export function changesFromLog(log) {
  const remarkAt = new Map(log.remarks.map((remark) => [remark.minute, remark]))
  return log.segments.map((segment, index) => {
    const remark = remarkAt.get(segment.start_minute)
    return {
      id: newId(),
      minute: segment.start_minute,
      status: segment.status,
      location: remark?.location ?? (index === 0 ? (log.from_label ?? '') : ''),
      note: remark?.note ?? '',
    }
  })
}

export const blankChanges = () => [{ id: newId(), minute: 0, status: 'OFF_DUTY', location: '', note: '' }]

export const editFromLog = (log) => ({
  changes: changesFromLog(log),
  miles: String(log.total_miles ?? 0),
  from: log.from_label ?? '',
  to: log.to_label ?? '',
})

/** Manual fill: an empty day (off duty all day) to build from scratch. */
export const blankEdit = () => ({ changes: blankChanges(), miles: '0', from: '', to: '' })

/** Change rows to the segments the sheet draws: sorted, same-status neighbours merged, ending at midnight. */
export function segmentsFromChanges(changes) {
  const sorted = [...changes].sort((a, b) => a.minute - b.minute)
  const segments = []
  sorted.forEach((change, index) => {
    const end = index + 1 < sorted.length ? sorted[index + 1].minute : MINUTES_PER_DAY
    if (end <= change.minute) return // two changes at the same minute: the later one wins, this one is skipped
    const last = segments[segments.length - 1]
    if (last && last.status === change.status && last.end_minute === change.minute) last.end_minute = end
    else segments.push({ status: change.status, start_minute: change.minute, end_minute: end })
  })
  return segments
}

/** Remarks for the sheet: one per change that has a place or a note, plus every change after midnight. */
export function remarksFromChanges(changes) {
  return [...changes]
    .sort((a, b) => a.minute - b.minute)
    .filter((change) => change.minute > 0 || change.location.trim() || change.note.trim())
    .map((change) => ({
      minute: change.minute,
      location: change.location.trim() || null,
      note: change.note.trim() || STATUS_LABELS[change.status].replace(' (not driving)', ''),
    }))
}

export function totalsOf(segments) {
  const totals = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]))
  for (const segment of segments) totals[segment.status] += segment.end_minute - segment.start_minute
  return totals
}

const hoursOf = (totals) => Object.fromEntries(Object.entries(totals).map(([status, minutes]) => [status, Math.round((minutes / 60) * 100) / 100]))

/**
 * Problems with the rows. `errors` stop the sheet being right (a time that is not valid, two changes at the same
 * minute); `warnings` are advice (FMCSA wants a place at every change of duty status).
 */
export function changeProblems(changes) {
  const errors = {}
  const warnings = {}
  const seen = new Map()
  for (const change of changes) {
    if (!Number.isInteger(change.minute) || change.minute < 0 || change.minute >= MINUTES_PER_DAY) {
      errors[change.id] = 'Enter a valid time'
      continue
    }
    if (seen.has(change.minute)) errors[change.id] = 'Another change is at this time'
    else seen.set(change.minute, change.id)
    if (!change.location.trim()) warnings[change.id] = 'Add the place for this change'
  }
  return { errors, warnings }
}

// ---- applying edits to a trip's logs ------------------------------------------------------------------------------

const parseMiles = (text) => {
  const value = Number(text)
  return Number.isFinite(value) && value > 0 ? round1(value) : 0
}

/**
 * The actual logs: each day as edited (or as planned if not edited). On-duty hours change the cycle, so a change on
 * one day moves the cycle figures in the recap of that day and the days after it. (A 34-hour restart ends the carry-over.)
 */
export function applyEdits(logs, edits) {
  let carried = 0
  return logs.map((planned) => {
    const edit = edits[planned.date]
    const segments = edit ? segmentsFromChanges(edit.changes) : planned.segments
    const totals = edit ? totalsOf(segments) : planned.totals_minutes
    const onDuty = totals.DRIVING + totals.ON_DUTY_NOT_DRIVING
    const dayChange = onDuty - planned.recap.on_duty_minutes_today
    carried = planned.recap.restart_completed ? dayChange : carried + dayChange

    if (!edit && carried === 0) return planned
    const cycleUsed = Math.max(0, planned.recap.cycle_used_minutes + carried)
    const recap = {
      ...planned.recap,
      on_duty_minutes_today: onDuty,
      cycle_used_minutes: cycleUsed,
      cycle_available_minutes: Math.max(0, CYCLE_LIMIT_MINUTES - cycleUsed),
    }
    if (!edit) return { ...planned, recap }

    return {
      ...planned,
      segments,
      totals_minutes: totals,
      totals_hours: hoursOf(totals),
      total_miles: parseMiles(edit.miles),
      from_label: edit.from.trim() || null,
      to_label: edit.to.trim() || null,
      remarks: remarksFromChanges(edit.changes),
      recap,
    }
  })
}

// ---- comparing with the plan --------------------------------------------------------------------------------------

function statusPerMinute(segments) {
  const minutes = new Array(MINUTES_PER_DAY).fill(null)
  for (const segment of segments) minutes.fill(segment.status, segment.start_minute, segment.end_minute)
  return minutes
}

/** The stretches of the day where the actual status differs from the planned one. */
export function diffSegments(plannedSegments, actualSegments) {
  const planned = statusPerMinute(plannedSegments)
  const actual = statusPerMinute(actualSegments)
  const intervals = []
  for (let minute = 0; minute < MINUTES_PER_DAY; minute += 1) {
    if (planned[minute] === actual[minute]) continue
    const last = intervals[intervals.length - 1]
    if (last && last.end === minute && last.planned === planned[minute] && last.actual === actual[minute]) last.end = minute + 1
    else intervals.push({ start: minute, end: minute + 1, planned: planned[minute], actual: actual[minute] })
  }
  return intervals
}

function placeChanges(planned, actual) {
  const plannedAt = new Map(planned.remarks.map((remark) => [remark.minute, remark]))
  return actual.remarks.flatMap((remark) => {
    const before = plannedAt.get(remark.minute)
    if (!before || !before.location || !remark.location || before.location === remark.location) return []
    return [{ minute: remark.minute, planned: before.location, actual: remark.location }]
  })
}

/** How one day's actual log differs from its plan. */
export function compareDay(planned, actual) {
  const intervals = actual === planned ? [] : diffSegments(planned.segments, actual.segments)
  const minutesDifferent = intervals.reduce((sum, interval) => sum + (interval.end - interval.start), 0)
  const totalsDelta = Object.fromEntries(
    STATUS_ORDER.map((status) => [status, actual.totals_minutes[status] - planned.totals_minutes[status]]),
  )
  const milesDelta = round1(actual.total_miles - planned.total_miles)
  const places = actual === planned ? [] : placeChanges(planned, actual)
  return {
    date: planned.date,
    changed: minutesDifferent > 0 || Math.abs(milesDelta) >= 0.05 || places.length > 0,
    minutesDifferent,
    intervals,
    totalsDelta,
    milesDelta,
    placeChanges: places,
  }
}

/** Whole-trip numbers for the summary line. */
export function summarizeComparisons(comparisons) {
  const changed = comparisons.filter((comparison) => comparison.changed)
  const sum = (pick) => comparisons.reduce((total, comparison) => total + pick(comparison), 0)
  return {
    daysChanged: changed.length,
    dates: changed.map((comparison) => comparison.date),
    minutesDifferent: sum((c) => c.minutesDifferent),
    drivingDelta: sum((c) => c.totalsDelta.DRIVING),
    onDutyDelta: sum((c) => c.totalsDelta.ON_DUTY_NOT_DRIVING),
    milesDelta: round1(sum((c) => c.milesDelta)),
  }
}
