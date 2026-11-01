// Port of util/DateUtils.kt plus helpers used across screens.

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
})
const timeFmt = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

export function formatDate(ts: number | Date): string {
  return dateFmt.format(typeof ts === 'number' ? new Date(ts) : ts)
}

/** "Nov 2" — compact label for task due hints and event rows. */
export function formatShortDate(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatTime(ts: number | Date): string {
  return timeFmt.format(typeof ts === 'number' ? new Date(ts) : ts)
}

export function formatDateTime(ts: number | Date): string {
  return `${formatDate(ts)} ${formatTime(ts)}`
}

export function startOfDay(ts: number = Date.now()): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function endOfDay(ts: number = Date.now()): number {
  const d = new Date(ts)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

/** [start, end] epoch millis for a 1-based month. */
export function monthRange(year: number, month: number): [number, number] {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0).getTime()
  const end = new Date(year, month, 0, 23, 59, 59, 999).getTime()
  return [start, end]
}

export function toDateKey(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/** Days between two local dates (calendar days, DST safe). */
export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12)
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 12)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** ISO weekday: Monday=1 … Sunday=7. */
export function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay()
}

export function addDays(ts: number | Date, days: number): Date {
  const d = new Date(ts)
  d.setDate(d.getDate() + days)
  return d
}

/** Clamp a billing-cycle day to a real day in the given month. */
export function clampDay(year: number, month: number, day: number): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  return Math.min(Math.max(1, day), daysInMonth)
}

/** Value for <input type="date"> */
export function toDateInput(ts: number | null): string {
  if (ts == null) return ''
  return toDateKey(ts)
}

export function fromDateInput(value: string): number | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 12, 0, 0, 0).getTime()
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour <= 11) return 'Good morning'
  if (hour >= 12 && hour <= 17) return 'Good afternoon'
  if (hour >= 18 && hour <= 21) return 'Good evening'
  return 'Good night'
}

/** Format a YYYY-MM-DD key as "d MMM" / "d MMM yyyy". */
export function formatDateKey(key: string, withYear = false): string {
  const d = fromDateKey(key)
  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}
