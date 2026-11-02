import { db } from './db'

const MARKER_KEY = 'clarity.habitsClearedMonth'
const INIT_KEY = 'clarity.habitsClearInitialized'

/**
 * Most recent month-end boundary (last day, 23:30 device local time) that has
 * already passed. `monthKey` identifies the month that ended.
 */
function lastMonthEnd(now: Date): { at: Date; monthKey: string } {
  const lastDayThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 30, 0, 0)
  const at =
    lastDayThisMonth.getTime() <= now.getTime()
      ? lastDayThisMonth
      : new Date(now.getFullYear(), now.getMonth(), 0, 23, 30, 0, 0)
  const monthKey = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`
  return { at, monthKey }
}

/**
 * Delete every habit (and its now-empty groups) once a month has ended (last
 * day, 23:30 local time). Events, notes, money data and journals are left alone.
 *
 * Runs on launch and on a minute timer, so an app that was closed at the
 * boundary catches up the next time it opens instead of leaving stale habits
 * to be removed by hand. Returns true when habits were actually deleted.
 */
export async function clearHabitsIfDue(now: Date = new Date()): Promise<boolean> {
  const { monthKey } = lastMonthEnd(now)

  if (localStorage.getItem(INIT_KEY) !== '1') {
    // First run after this feature shipped: record the boundary without
    // deleting, so habits created this month aren't wiped mid-month.
    localStorage.setItem(INIT_KEY, '1')
    if (!localStorage.getItem(MARKER_KEY)) localStorage.setItem(MARKER_KEY, monthKey)
  }

  if (localStorage.getItem(MARKER_KEY) === monthKey) return false

  const count = await db.habits.count()
  // Mark first so a concurrent run can't delete twice.
  localStorage.setItem(MARKER_KEY, monthKey)
  if (count === 0) return false

  await db.transaction('rw', db.habits, db.habitGroups, async () => {
    await db.habits.clear()
    await db.habitGroups.clear()
  })
  return true
}

/** Re-check every minute and whenever the app becomes visible. */
export function startHabitMonthlyCleanup(): () => void {
  const timer = window.setInterval(() => void clearHabitsIfDue(), 60_000)
  const onVisible = () => {
    if (document.visibilityState === 'visible') void clearHabitsIfDue()
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
