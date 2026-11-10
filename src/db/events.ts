import { db } from './db'
import type { Event, HabitFrequency, Priority } from './types'
import {
  addDays,
  daysBetween,
  endOfDay,
  fromDateKey,
  isoWeekday,
  startOfDay,
  toDateKey,
} from '../lib/dates'

export const EVENT_FREQUENCIES: Array<{ value: HabitFrequency | ''; label: string }> = [
  { value: '', label: 'Does not repeat' },
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Alternate', label: 'Alternate days' },
  { value: 'Custom', label: 'Custom days' },
]

export const EVENT_WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Recurrence is anchored on the event's start day (midnight-safe). */
export function eventAnchorDate(event: Event): Date {
  return fromDateKey(toDateKey(event.startDate))
}

/**
 * Same rules as habits, anchored on the event start day:
 *  - Daily: every day
 *  - Weekly: every 7 days from the start day
 *  - Monthly: same day-of-month as the start day (clamped to short months)
 *  - Alternate: every `alternateDays + 1` days from the start day
 *  - Custom: chosen ISO weekdays
 */
export function isEventScheduledOn(event: Event, date: Date): boolean {
  if (!event.frequency) return false
  const anchor = eventAnchorDate(event)
  const target = fromDateKey(toDateKey(date))
  const diff = daysBetween(anchor, target)
  if (diff < 0) return false

  switch (event.frequency) {
    case 'Weekly':
      return diff % 7 === 0
    case 'Monthly': {
      const anchorDay = anchor.getDate()
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
      return target.getDate() === Math.min(anchorDay, lastDay)
    }
    case 'Alternate': {
      const gap = event.alternateDays != null && event.alternateDays >= 1 ? event.alternateDays + 1 : 1
      return diff % gap === 0
    }
    case 'Custom': {
      const days = event.selectedDays ?? []
      return days.length === 0 ? true : days.includes(isoWeekday(target))
    }
    default:
      return true
  }
}

function timeOnDay(template: number, date: Date): number {
  const t = new Date(template)
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    t.getHours(),
    t.getMinutes(),
    0,
    0,
  ).getTime()
}

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/** Length of one occurrence. Overnight and multi-day spans survive recurrence. */
export function eventDuration(event: Event): number {
  return Math.max(HOUR_MS, event.endDate - event.startDate)
}

/**
 * The recurring occurrence that overlaps `date`, including one that started on
 * an earlier day (a 22:00–02:00 series appears on both days). Returns the
 * anchor day's key so completion/skip stay attached to the start occurrence.
 */
function recurringOccurrence(
  event: Event,
  date: Date,
): { start: number; end: number; key: string } | null {
  if (!event.frequency) return null
  const duration = eventDuration(event)
  const dayStart = startOfDay(date.getTime())
  const dayEnd = endOfDay(date.getTime())
  const daysBack = Math.min(7, Math.ceil(duration / DAY_MS))
  const base = fromDateKey(toDateKey(date))
  for (let offset = 0; offset <= daysBack; offset += 1) {
    const anchor = addDays(base, -offset)
    if (!isEventScheduledOn(event, anchor)) continue
    const start = timeOnDay(event.startDate, anchor)
    const end = start + duration
    if (start < dayEnd && end > dayStart) {
      return { start, end, key: toDateKey(anchor) }
    }
  }
  return null
}

export function isEventSkipped(event: Event, date: Date): boolean {
  if (!event.frequency) return false
  const key = recurringOccurrence(event, date)?.key ?? toDateKey(date)
  return event.skippedDates?.[key] === true
}

/** Does this event have an occurrence on the given local day? */
export function eventOccursOn(event: Event, date: Date): boolean {
  if (!event.frequency) {
    // One-off events can span multiple days.
    return event.startDate <= endOfDay(date.getTime()) && event.endDate >= startOfDay(date.getTime())
  }
  return recurringOccurrence(event, date) != null && !isEventSkipped(event, date)
}

/** Start/end for the occurrence on `date`, plus its completion key. */
export function eventOccurrence(event: Event, date: Date): { start: number; end: number; key: string } {
  if (!event.frequency) {
    return { start: event.startDate, end: event.endDate, key: toDateKey(event.startDate) }
  }
  const occurrence = recurringOccurrence(event, date)
  if (occurrence) return occurrence
  const start = timeOnDay(event.startDate, date)
  return { start, end: start + eventDuration(event), key: toDateKey(date) }
}

export function eventCompletionKey(event: Event, date: Date): string {
  if (!event.frequency) return toDateKey(event.startDate)
  return recurringOccurrence(event, date)?.key ?? toDateKey(date)
}

/** Due day: the explicit deadline for one-off events, occurrence day otherwise. */
export function eventDueKey(event: Event, date: Date): string {
  if (event.frequency) return eventCompletionKey(event, date)
  return toDateKey(event.dueDate ?? event.endDate)
}

export type EventStatus = 'done' | 'overdue' | 'due' | 'upcoming'

export function eventStatus(event: Event, date: Date, now: Date = new Date()): EventStatus {
  if (event.completionHistory?.[eventCompletionKey(event, date)]) return 'done'
  if (isEventSkipped(event, date)) return 'upcoming'
  const due = eventDueKey(event, date)
  const today = toDateKey(now)
  if (due < today) return 'overdue'
  if (due === today) return 'due'
  return 'upcoming'
}

/** Saved note for the occurrence on `date`, or an empty string. */
export function eventNote(event: Event, date: Date): string {
  return event.eventNotes?.[eventCompletionKey(event, date)] ?? ''
}

/** Save (or clear) the note for one occurrence. */
export async function updateEventNote(
  eventId: number,
  date: Date,
  note: string,
): Promise<void> {
  const event = await db.events.get(eventId)
  if (!event) return
  const key = eventCompletionKey(event, date)
  const eventNotes = { ...(event.eventNotes ?? {}) }
  if (note.trim()) eventNotes[key] = note.trim()
  else delete eventNotes[key]
  await db.events.update(eventId, { eventNotes })
}

/** Hide a single occurrence without touching the rest of the series. */
export async function skipEventOccurrence(eventId: number, date: Date): Promise<void> {
  const event = await db.events.get(eventId)
  if (!event || !event.frequency) return
  const key = eventCompletionKey(event, date)
  const skippedDates = { ...(event.skippedDates ?? {}), [key]: true }
  const completionHistory = { ...(event.completionHistory ?? {}) }
  delete completionHistory[key]
  await db.events.update(eventId, { skippedDates, completionHistory })
}

export async function toggleEventCompletion(
  eventId: number,
  date: Date,
  completed: boolean,
): Promise<void> {
  const event = await db.events.get(eventId)
  if (!event) return
  const history = { ...(event.completionHistory ?? {}) }
  const key = eventCompletionKey(event, date)
  if (completed) history[key] = true
  else delete history[key]
  await db.events.update(eventId, { completionHistory: history })
}

/**
 * Uncompleted occurrences that fell before today, oldest first. A recurring
 * event can have many missed days; the home card shows the head of the backlog
 * plus the count.
 */
export function overdueOccurrences(event: Event, now: Date = new Date()): Date[] {
  if (!event.frequency) {
    const occurrence = new Date(event.startDate)
    return eventStatus(event, occurrence, now) === 'overdue' ? [occurrence] : []
  }
  const anchor = eventAnchorDate(event)
  const yesterdayKey = toDateKey(addDays(now, -1))
  if (toDateKey(anchor) > yesterdayKey) return []
  const missed: Date[] = []
  let day = anchor
  for (let i = 0; i < 732; i += 1) {
    if (toDateKey(day) > yesterdayKey) break
    if (
      isEventScheduledOn(event, day) &&
      !isEventSkipped(event, day) &&
      event.completionHistory?.[eventCompletionKey(event, day)] !== true
    ) {
      missed.push(new Date(timeOnDay(event.startDate, day)))
    }
    day = addDays(day, 1)
  }
  return missed
}

/** Has any scheduled occurrence before today gone uncompleted? */
export function hasOverdueOccurrence(event: Event, now: Date = new Date()): boolean {
  return overdueOccurrences(event, now).length > 0
}

/** First uncompleted occurrence on/after `from`, or null when there is none. */
export function nextEventOccurrence(event: Event, from: Date): Date | null {
  if (!event.frequency) {
    const done = event.completionHistory?.[toDateKey(event.startDate)] === true
    const deadlineKey = toDateKey(event.dueDate ?? event.endDate)
    return !done && deadlineKey >= toDateKey(from) ? new Date(event.startDate) : null
  }
  for (let i = 0; i < 366; i += 1) {
    const day = addDays(from, i)
    if (
      isEventScheduledOn(event, day) &&
      !isEventSkipped(event, day) &&
      event.completionHistory?.[eventCompletionKey(event, day)] !== true
    ) {
      return new Date(timeOnDay(event.startDate, day))
    }
  }
  return null
}

export function eventFrequencyLabel(event: Event): string {
  if (!event.frequency) return 'One-off'
  if (event.frequency === 'Alternate') {
    return `Every ${(event.alternateDays ?? 0) + 1} days`
  }
  if (event.frequency === 'Custom') {
    const days = event.selectedDays ?? []
    return days.length > 0
      ? days.map((d) => EVENT_WEEKDAY_NAMES[d - 1]).join(', ')
      : 'Custom days'
  }
  return event.frequency
}

/** Normalise a backup event (old backups have none of the task fields). */
const EVENT_PRIORITIES = new Set<Priority>(['High', 'Medium', 'Low'])
const EVENT_FREQUENCY_VALUES = new Set<HabitFrequency>([
  'Daily',
  'Weekly',
  'Monthly',
  'Alternate',
  'Custom',
])

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/**
 * Normalise a row from a backup before it reaches the UI. Every field is
 * rebuilt explicitly so an unknown/typed-wrong key in the JSON cannot leak
 * into stored records.
 */
export function eventDefaults(event: Partial<Event>): Event {
  const startDate = finiteOr(event.startDate, Date.now())
  const priority =
    typeof event.priority === 'string' && EVENT_PRIORITIES.has(event.priority as Priority)
      ? (event.priority as Priority)
      : null
  const frequency =
    typeof event.frequency === 'string' &&
    EVENT_FREQUENCY_VALUES.has(event.frequency as HabitFrequency)
      ? (event.frequency as HabitFrequency)
      : null
  return {
    title: String(event.title ?? 'Event'),
    description: String(event.description ?? ''),
    startDate,
    endDate: finiteOr(event.endDate, startDate + 3_600_000),
    category: String(event.category ?? ''),
    color: String(event.color ?? '#4A90D9'),
    isAllDay: Boolean(event.isAllDay),
    reminderTime:
      typeof event.reminderTime === 'number' && Number.isFinite(event.reminderTime)
        ? event.reminderTime
        : null,
    priority,
    dueDate:
      typeof event.dueDate === 'number' && Number.isFinite(event.dueDate)
        ? event.dueDate
        : null,
    frequency,
    alternateDays:
      typeof event.alternateDays === 'number' && event.alternateDays >= 1
        ? Math.floor(event.alternateDays)
        : null,
    selectedDays: Array.isArray(event.selectedDays)
      ? event.selectedDays.filter(
          (day): day is number => Number.isInteger(day) && day >= 1 && day <= 7,
        )
      : null,
    completionHistory:
      event.completionHistory && typeof event.completionHistory === 'object'
        ? event.completionHistory
        : {},
    skippedDates:
      event.skippedDates && typeof event.skippedDates === 'object'
        ? event.skippedDates
        : {},
    eventNotes:
      event.eventNotes && typeof event.eventNotes === 'object' ? event.eventNotes : {},
    createdAt: finiteOr(event.createdAt, Date.now()),
  }
}
