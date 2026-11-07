import { db } from './db'
import type { Habit } from './types'
import { addDays, daysBetween, fromDateKey, isoWeekday, toDateKey } from '../lib/dates'

export const HABIT_FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Alternate', 'Custom'] as const
export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function habitCreatedDate(habit: Habit): Date {
  return fromDateKey(toDateKey(habit.createdAt))
}

/** Archive/delete date is inclusive: the habit is still active on that day. */
export function habitEndDate(habit: Habit): Date | null {
  const ts = habit.deletedAt ?? habit.archivedAt ?? null
  return ts == null ? null : fromDateKey(toDateKey(ts))
}

export function isHabitActiveOn(habit: Habit, date: Date): boolean {
  const created = habitCreatedDate(habit)
  const end = habitEndDate(habit)
  const key = toDateKey(date)
  if (key < toDateKey(created)) return false
  if (end && key > toDateKey(end)) return false
  return true
}

/**
 * Scheduling rules:
 *  - Daily: every day
 *  - Weekly: every 7 days from creation (Android treated it as daily)
 *  - Monthly: same day-of-month as creation (clamped to short months)
 *  - Alternate: every `alternateDays + 1` days from creation
 *  - Custom: chosen ISO weekdays
 */
export function isScheduledOn(habit: Habit, date: Date): boolean {
  if (!isHabitActiveOn(habit, date)) return false
  const created = habitCreatedDate(habit)
  const diff = daysBetween(created, date)

  switch (habit.frequency) {
    case 'Weekly':
      return diff % 7 === 0
    case 'Monthly': {
      const createdDay = created.getDate()
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
      return date.getDate() === Math.min(createdDay, lastDay)
    }
    case 'Alternate':
      return habit.alternateDays != null && habit.alternateDays >= 1
        ? diff % (habit.alternateDays + 1) === 0
        : true
    case 'Custom':
      return habit.selectedDays != null && habit.selectedDays.length > 0
        ? habit.selectedDays.includes(isoWeekday(date))
        : true
    default:
      return true
  }
}

/** Manual ordering: sortOrder, then creation time, then id. */
export function compareHabits(a: Habit, b: Habit): number {
  const ao = a.sortOrder ?? Number.MAX_SAFE_INTEGER
  const bo = b.sortOrder ?? Number.MAX_SAFE_INTEGER
  if (ao !== bo) return ao - bo
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
  return (a.id ?? 0) - (b.id ?? 0)
}

/**
 * Streak: walk backwards from today (or yesterday when today isn't done yet),
 * skip non-scheduled days, stop at the first scheduled day that isn't complete.
 */
export function computeStreak(habit: Habit, today: Date = new Date()): number {
  const created = habitCreatedDate(habit)
  const todayKey = toDateKey(today)
  let cursor = fromDateKey(todayKey)

  if (!(isScheduledOn(habit, cursor) && habit.completionHistory[todayKey] === true)) {
    cursor = addDays(cursor, -1)
  }

  let streak = 0
  while (cursor >= created) {
    if (!isScheduledOn(habit, cursor)) {
      cursor = addDays(cursor, -1)
      continue
    }
    const cursorKey = toDateKey(cursor)
    // A skipped day is neutral: it neither extends nor breaks the streak.
    if (habit.skippedDates?.[cursorKey]) {
      cursor = addDays(cursor, -1)
      continue
    }
    if (habit.completionHistory[cursorKey] === true) {
      streak++
      cursor = addDays(cursor, -1)
    } else {
      break
    }
  }
  return streak
}

/** Best streak ever: scan creation → today and track the longest run. */
export function computeBestStreak(habit: Habit, today: Date = new Date()): number {
  const created = habitCreatedDate(habit)
  const end = fromDateKey(toDateKey(today))
  let best = 0
  let run = 0
  let cursor = created
  // A day-by-day scan is cheap even for decade-old habits; the old 10-year
  // guard silently under-reported the best streak for older data.
  while (cursor <= end) {
    if (isScheduledOn(habit, cursor)) {
      const cursorKey = toDateKey(cursor)
      if (habit.skippedDates?.[cursorKey]) {
        // Skipped days are neutral and do not reset the run.
      } else if (habit.completionHistory[cursorKey] === true) {
        run++
        best = Math.max(best, run)
      } else {
        run = 0
      }
    }
    cursor = addDays(cursor, 1)
  }
  return best
}

/**
 * Best-streak writes are monotonic: once a stored value exists, only the
 * current streak can raise it. A full history scan is therefore needed only
 * for legacy/imported rows whose `bestStreak` was never computed.
 */
export function nextBestStreak(previous: Habit, next: Habit, streak: number): number {
  if ((previous.bestStreak ?? 0) > 0) return Math.max(previous.bestStreak, streak)
  return Math.max(computeBestStreak(next), streak)
}

export async function refreshHabitStats(habitId: number): Promise<void> {
  const habit = await db.habits.get(habitId)
  if (!habit) return
  const streak = computeStreak(habit)
  const best = nextBestStreak(habit, habit, streak)
  if (streak !== habit.currentStreak || best !== habit.bestStreak) {
    await db.habits.update(habitId, { currentStreak: streak, bestStreak: best })
  }
}

function deadlinePassedFor(habit: Habit, date: Date, now: Date): boolean {
  if (habit.deadlineHour == null || habit.deadlineMinute == null) return false
  const todayKey = toDateKey(now)
  const key = toDateKey(date)
  if (key < todayKey) return true
  if (key > todayKey) return false
  const deadline = new Date(now)
  deadline.setHours(habit.deadlineHour, habit.deadlineMinute, 0, 0)
  return now.getTime() > deadline.getTime()
}

export async function toggleHabitForDate(
  habitId: number,
  dateKey: string,
  completed: boolean,
): Promise<void> {
  const habit = await db.habits.get(habitId)
  if (!habit) return
  const todayKey = toDateKey(new Date())
  const history = { ...habit.completionHistory }
  const late = new Set(habit.lateCompletions)
  const skippedDates = { ...(habit.skippedDates ?? {}) }
  delete skippedDates[dateKey]

  if (!completed && dateKey === todayKey) {
    // Un-checking today means "pending", not "missed".
    delete history[dateKey]
    late.delete(dateKey)
  } else {
    history[dateKey] = completed
    if (completed) {
      // "Done" means on time. Only today's check can still be late implicitly;
      // past days use the explicit "Done late" action so the two chips stay
      // distinguishable in history.
      if (dateKey === todayKey && deadlinePassedFor(habit, fromDateKey(dateKey), new Date())) {
        late.add(dateKey)
      } else {
        late.delete(dateKey)
      }
    } else {
      late.delete(dateKey)
    }
  }

  const next: Habit = {
    ...habit,
    completionHistory: history,
    lateCompletions: [...late],
    skippedDates,
  }
  const streak = computeStreak(next)
  const best = nextBestStreak(habit, next, streak)
  await db.habits.update(habitId, {
    completionHistory: history,
    lateCompletions: [...late],
    skippedDates,
    currentStreak: streak,
    bestStreak: best,
  })
}

export async function completeHabitLate(habitId: number, dateKey: string): Promise<void> {
  const habit = await db.habits.get(habitId)
  if (!habit) return
  const history = { ...habit.completionHistory, [dateKey]: true }
  const late = new Set(habit.lateCompletions).add(dateKey)
  const skippedDates = { ...(habit.skippedDates ?? {}) }
  delete skippedDates[dateKey]
  const next: Habit = {
    ...habit,
    completionHistory: history,
    lateCompletions: [...late],
    skippedDates,
  }
  const streak = computeStreak(next)
  const best = nextBestStreak(habit, next, streak)
  await db.habits.update(habitId, {
    completionHistory: history,
    lateCompletions: [...late],
    skippedDates,
    currentStreak: streak,
    bestStreak: best,
  })
}

export async function setHabitMissed(habitId: number, dateKey: string): Promise<void> {
  const habit = await db.habits.get(habitId)
  if (!habit) return
  const history = { ...habit.completionHistory, [dateKey]: false }
  const late = habit.lateCompletions.filter((d) => d !== dateKey)
  const skippedDates = { ...(habit.skippedDates ?? {}) }
  delete skippedDates[dateKey]
  const next: Habit = {
    ...habit,
    completionHistory: history,
    lateCompletions: late,
    skippedDates,
  }
  const streak = computeStreak(next)
  const best = nextBestStreak(habit, next, streak)
  await db.habits.update(habitId, {
    completionHistory: history,
    lateCompletions: late,
    skippedDates,
    currentStreak: streak,
    bestStreak: best,
  })
}

/** Skip a scheduled day. The caller is responsible for storing the reason. */
export async function setHabitSkipped(habitId: number, dateKey: string): Promise<void> {
  const habit = await db.habits.get(habitId)
  if (!habit) return
  const history = { ...habit.completionHistory }
  delete history[dateKey]
  const late = habit.lateCompletions.filter((d) => d !== dateKey)
  const skippedDates = { ...(habit.skippedDates ?? {}), [dateKey]: true }
  const next: Habit = {
    ...habit,
    completionHistory: history,
    lateCompletions: late,
    skippedDates,
  }
  const streak = computeStreak(next)
  const best = nextBestStreak(habit, next, streak)
  await db.habits.update(habitId, {
    completionHistory: history,
    lateCompletions: late,
    skippedDates,
    currentStreak: streak,
    bestStreak: best,
  })
}

/** Remove any completion/miss/skip entry so the day is pending again. */
export async function setHabitPending(habitId: number, dateKey: string): Promise<void> {
  const habit = await db.habits.get(habitId)
  if (!habit) return
  const history = { ...habit.completionHistory }
  delete history[dateKey]
  const late = habit.lateCompletions.filter((d) => d !== dateKey)
  const skippedDates = { ...(habit.skippedDates ?? {}) }
  delete skippedDates[dateKey]
  const next: Habit = {
    ...habit,
    completionHistory: history,
    lateCompletions: late,
    skippedDates,
  }
  const streak = computeStreak(next)
  const best = nextBestStreak(habit, next, streak)
  await db.habits.update(habitId, {
    completionHistory: history,
    lateCompletions: late,
    skippedDates,
    currentStreak: streak,
    bestStreak: best,
  })
}

/**
 * Fill in `false` for scheduled days up to yesterday that have no entry.
 * Never overwrites an existing true/false, unlike the Android backfill.
 */
export async function markMissedDays(habitId: number): Promise<void> {
  const habit = await db.habits.get(habitId)
  if (!habit || habit.isDeleted) return
  const today = fromDateKey(toDateKey(new Date()))
  const created = habitCreatedDate(habit)
  const history = { ...habit.completionHistory }
  let changed = false

  // Fill backwards from yesterday so an old habit gets its *recent* history
  // marked, not the first two years after creation. The guard bounds the work
  // for very old data.
  let cursor = addDays(today, -1)
  let guard = 0
  while (cursor >= created && guard < 732) {
    guard++
    const key = toDateKey(cursor)
    if (isScheduledOn(habit, cursor) && !(key in history) && !habit.skippedDates?.[key]) {
      history[key] = false
      changed = true
    }
    cursor = addDays(cursor, -1)
  }

  if (!changed) {
    await refreshHabitStats(habitId)
    return
  }
  const next: Habit = { ...habit, completionHistory: history }
  const streak = computeStreak(next)
  const best = nextBestStreak(habit, next, streak)
  await db.habits.update(habitId, {
    completionHistory: history,
    currentStreak: streak,
    bestStreak: best,
  })
}

export async function markMissedDaysForAll(): Promise<void> {
  const habits = await db.habits.toArray()
  for (const habit of habits) {
    if (habit.isDeleted) continue
    await markMissedDays(habit.id!)
  }
}

export async function archiveHabit(habitId: number): Promise<void> {
  await db.habits.update(habitId, { isArchived: true, archivedAt: Date.now() })
}

export async function unarchiveHabit(habitId: number): Promise<void> {
  await db.habits.update(habitId, { isArchived: false, archivedAt: null })
}

export async function softDeleteHabit(habitId: number): Promise<void> {
  await db.habits.update(habitId, { isDeleted: true, deletedAt: Date.now() })
}

export async function updateHabitDailyNote(
  habitId: number,
  dateKey: string,
  note: string,
): Promise<void> {
  const habit = await db.habits.get(habitId)
  if (!habit) return
  const dailyNotes = { ...habit.dailyNotes }
  if (note.trim()) dailyNotes[dateKey] = note.trim()
  else delete dailyNotes[dateKey]
  await db.habits.update(habitId, { dailyNotes })
}

export function habitFrequencyLabel(habit: Habit): string {
  switch (habit.frequency) {
    case 'Alternate':
      return `Every ${(habit.alternateDays ?? 1) + 1} days`
    case 'Custom':
      return (habit.selectedDays ?? [])
        .slice()
        .sort((a, b) => a - b)
        .map((d) => WEEKDAY_NAMES[d - 1])
        .join(', ')
    case 'Weekly':
      return 'Weekly'
    case 'Monthly':
      return 'Monthly'
    default:
      return 'Daily'
  }
}

export function isDeadlinePassedToday(habit: Habit, now: Date = new Date()): boolean {
  if (habit.deadlineHour == null || habit.deadlineMinute == null) return false
  const todayKey = toDateKey(now)
  if (habit.completionHistory[todayKey] === true) return false
  if (habit.skippedDates?.[todayKey]) return false
  if (!isScheduledOn(habit, fromDateKey(todayKey))) return false
  return deadlinePassedFor(habit, fromDateKey(todayKey), now)
}

/** Latest explicit miss (false) on/after creation. */
export function latestMissed(habit: Habit): string | null {
  const createdKey = toDateKey(habit.createdAt)
  const missed = Object.entries(habit.completionHistory)
    .filter(([date, done]) => done === false && date >= createdKey)
    .map(([date]) => date)
    .sort()
  return missed.length ? missed[missed.length - 1] : null
}
