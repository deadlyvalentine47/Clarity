import { db } from './db'
import type { Event, HabitFrequency } from './types'
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

export function isEventSkipped(event: Event, date: Date): boolean {
  return event.skippedDates?.[toDateKey(date)] === true
}

/** Does this event have an occurrence on the given local day? */
export function eventOccursOn(event: Event, date: Date): boolean {
  if (!event.frequency) {
    // One-off events can span multiple days.
    return event.startDate <= endOfDay(date.getTime()) && event.endDate >= startOfDay(date.getTime())
  }
  return isEventScheduledOn(event, date) && !isEventSkipped(event, date)
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

/** Start/end for the occurrence on `date`, plus its completion key. */
export function eventOccurrence(event: Event, date: Date): { start: number; end: number; key: string } {
  if (!event.frequency) {
    return { start: event.startDate, end: event.endDate, key: toDateKey(event.startDate) }
  }
  const start = timeOnDay(event.startDate, date)
  let end = timeOnDay(event.endDate, date)
  if (end <= start) end = start + 3_600_000
  return { start, end, key: toDateKey(date) }
}

export function eventCompletionKey(event: Event, date: Date): string {
  return event.frequency ? toDateKey(date) : toDateKey(event.startDate)
}

/** Due day: the explicit deadline for one-off events, occurrence day otherwise. */
export function eventDueKey(event: Event, date: Date): string {
  if (event.frequency) return toDateKey(date)
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

/** Hide a single occurrence without touching the rest of the series. */
export async function skipEventOccurrence(eventId: number, date: Date): Promise<void> {
  const event = await db.events.get(eventId)
  if (!event || !event.frequency) return
  const key = toDateKey(date)
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

/** Has any scheduled occurrence before today gone uncompleted? */
export function hasOverdueOccurrence(event: Event, now: Date = new Date()): boolean {
  if (!event.frequency) {
    return eventStatus(event, new Date(event.startDate), now) === 'overdue'
  }
  const anchor = eventAnchorDate(event)
  const yesterdayKey = toDateKey(addDays(now, -1))
  if (toDateKey(anchor) > yesterdayKey) return false
  let day = anchor
  for (let i = 0; i < 732; i += 1) {
    if (toDateKey(day) > yesterdayKey) break
    if (
      isEventScheduledOn(event, day) &&
      !isEventSkipped(event, day) &&
      event.completionHistory?.[toDateKey(day)] !== true
    ) {
      return true
    }
    day = addDays(day, 1)
  }
  return false
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
      event.completionHistory?.[toDateKey(day)] !== true
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
export function eventDefaults(event: Partial<Event>): Event {
  const startDate = Number(event.startDate ?? Date.now())
  return {
    title: String(event.title ?? 'Event'),
    description: String(event.description ?? ''),
    startDate,
    endDate: Number(event.endDate ?? startDate + 3_600_000),
    category: String(event.category ?? ''),
    color: String(event.color ?? '#4A90D9'),
    isAllDay: Boolean(event.isAllDay),
    reminderTime: event.reminderTime ?? null,
    priority: event.priority ?? null,
    dueDate: event.dueDate ?? null,
    frequency: event.frequency ?? null,
    alternateDays: event.alternateDays ?? null,
    selectedDays: Array.isArray(event.selectedDays) ? event.selectedDays : null,
    completionHistory:
      event.completionHistory && typeof event.completionHistory === 'object'
        ? event.completionHistory
        : {},
    skippedDates:
      event.skippedDates && typeof event.skippedDates === 'object'
        ? event.skippedDates
        : {},
    createdAt: Number(event.createdAt ?? Date.now()),
  }
}
