// Types mirror the Room entities in app/src/main/java/com/clarity/app/data/local/database.

export type Priority = 'High' | 'Medium' | 'Low'
export type RecurringType = 'Daily' | 'Weekly' | 'Monthly' | 'Custom'
export type GoalType = 'Short-term' | 'Long-term'
export type GoalStatus = 'In Progress' | 'On Hold' | 'Completed'
export type HabitFrequency = 'Daily' | 'Weekly' | 'Monthly' | 'Alternate' | 'Custom'
export type TransactionType = 'Income' | 'Expense'
export type CardTxnType = 'Purchase' | 'Payment' | 'Credit'
export type ThemeMode = 'system' | 'light' | 'dark'
export type DistanceUnit = 'km' | 'mi'

export interface Habit {
  id?: number
  name: string
  description: string
  frequency: HabitFrequency
  /** used when frequency === 'Alternate' */
  alternateDays?: number | null
  /** ISO weekdays 1=Mon..7=Sun, used when frequency === 'Custom' */
  selectedDays?: number[] | null
  targetCount: number
  currentStreak: number
  bestStreak: number
  /** date (YYYY-MM-DD) -> completed */
  completionHistory: Record<string, boolean>
  /** dates completed after the deadline */
  lateCompletions: string[]
  /** date (YYYY-MM-DD) -> skipped; the reason lives in dailyNotes */
  skippedDates: Record<string, boolean>
  reminderTime: number | null
  isArchived: boolean
  archivedAt?: number | null
  isDeleted: boolean
  deletedAt?: number | null
  deadlineHour?: number | null
  deadlineMinute?: number | null
  /** date -> note text */
  dailyNotes: Record<string, string>
  /** manual list position; lower comes first */
  sortOrder: number
  /** habit group id; null/undefined = shown directly in the habits list */
  groupId?: number | null
  createdAt: number
}

export interface HabitGroup {
  id?: number
  name: string
  /** manual position among the top-level habits and groups; lower comes first */
  sortOrder: number
  /** collapsed by default; only expanded when the user opens it */
  isCollapsed?: boolean
  createdAt: number
}

export interface Note {
  id?: number
  title: string
  content: string
  isPinned: boolean
  /** comma separated tag list */
  category: string
  parentNoteId?: number | null
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface NoteCategory {
  id?: number
  name: string
  createdAt: number
}

export interface NoteImage {
  /** uuid used in the ![img:uuid] marker */
  id: string
  blob: Blob
  createdAt: number
}

/** The single user-chosen background image. Stored as a blob, never in
 *  localStorage, so a photo does not eat the preferences quota. */
export interface WallpaperImage {
  id: string
  blob: Blob
  name: string
  createdAt: number
}

export interface Transaction {
  id?: number
  type: TransactionType
  amount: number
  category: string
  source: string
  description: string
  date: number
  isRecurring: boolean
  recurringType: RecurringType | null
  createdAt: number
  /** link to the credit-card payment row created for a bill payment */
  linkedCardTxnId?: number | null
  /** shared id linking the two legs of a self-transfer */
  transferGroupId?: string | null
}

export interface Category {
  id?: number
  name: string
  isDefault: boolean
  createdAt: number
}

export interface Source {
  id?: number
  name: string
  balance: number
  isDefault: boolean
  createdAt: number
}

export interface BudgetLimit {
  id?: number
  category: string
  limitAmount: number
  month: number // 1-12
  year: number
  createdAt: number
}

export interface GoalMilestone {
  /** stable identity — completion and notes are keyed by this, never by text */
  id: string
  text: string
  /** free-form note written from the goal detail page */
  note: string
  /** epoch ms when marked complete, null while pending */
  completedAt: number | null
}

export interface Goal {
  id?: number
  title: string
  description: string
  type: GoalType
  status: GoalStatus
  /** 0..1 — derived from milestones, 1 only when status is Completed */
  progress: number
  targetDate: number | null
  milestones: GoalMilestone[]
  isCompleted: boolean
  completedAt?: number | null
  createdAt: number
}

export interface Event {
  id?: number
  title: string
  description: string
  startDate: number
  endDate: number
  category: string
  color: string
  isAllDay: boolean
  reminderTime: number | null
  /** optional task priority */
  priority: Priority | null
  /** optional deadline (local noon); one-off events only */
  dueDate: number | null
  /** recurrence; null = one-off */
  frequency: HabitFrequency | null
  /** used when frequency === 'Alternate' */
  alternateDays: number | null
  /** ISO weekdays 1=Mon..7=Sun, used when frequency === 'Custom' */
  selectedDays: number[] | null
  /** occurrence date key (YYYY-MM-DD) -> completed */
  completionHistory: Record<string, boolean>
  /** occurrence date key -> deleted individually (recurring events only) */
  skippedDates: Record<string, boolean>
  /** occurrence date key (YYYY-MM-DD) -> note text */
  eventNotes: Record<string, string>
  createdAt: number
}

export interface CreditCard {
  id?: number
  name: string
  creditLimit: number
  billingCycleDay: number
  createdAt: number
}

export interface CreditCardTransaction {
  id?: number
  cardId: number
  amount: number
  description: string
  date: number
  type: CardTxnType
  createdAt: number
  /** link back to the bank expense when this Payment came from a bill payment */
  linkedTransactionId?: number | null
}

export interface Investment {
  id?: number
  name: string
  type: string
  units: number
  purchasePrice: number
  currentPrice: number
  purchaseDate: number
  notes: string
  createdAt: number
}

export interface DayJournal {
  /** YYYY-MM-DD (primary key) */
  date: string
  content: string
  updatedAt: number
}

/** One accepted GPS fix. Coordinates are stored at 6 decimal places. */
export interface RunPoint {
  /** epoch ms */
  t: number
  lat: number
  lng: number
  /** horizontal accuracy in metres */
  acc: number
  /** GNSS altitude in metres — coarse (±10-30 m) */
  alt?: number | null
  /** barometric altitude in metres relative to the start of the run */
  baro?: number | null
  spd?: number | null
}

export interface RunSession {
  id?: number
  /** optional user-given name, e.g. "Morning loop"; empty falls back to the date */
  name?: string
  startedAt: number
  endedAt: number | null
  /** active time, pauses excluded */
  durationSeconds: number
  distanceMeters: number
  /** true when the user typed/corrected the distance — never indexed */
  isManualDistance: boolean
  /**
   * Track is stored in `runTracks`, not on the row, so history queries stay
   * small. Backups still embed it here; `points` is absent on DB rows.
   */
  points?: RunPoint[]
  notes: string
  /** run group/session id; null/undefined = shown directly in the history list */
  groupId?: number | null
  /**
   * manual list position; lower comes first. null/undefined = never moved by
   * hand, so the list falls back to start time.
   */
  sortOrder?: number | null
  createdAt: number
}

/**
 * The GPS/barometer track for one run. Kept apart from `RunSession` because a
 * track can hold 5 000 points and the history list only needs the summary.
 */
export interface RunTrack {
  /** primary key = the owning run's id */
  runId: number
  /** downsampled: >= 5 m apart, cap 5000 */
  points: RunPoint[]
}

/** A named session that bundles several runs (walk → run → walk). */
export interface RunGroup {
  id?: number
  name: string
  /** manual position among the history list; lower comes first */
  sortOrder?: number | null
  /** expanded by default; only collapsed when the user hides it */
  isCollapsed?: boolean
  createdAt: number
}


export const HOME_SECTIONS = [
  'Events',
  'Habits',
  'Runs',
  'Budget',
  'Notes',
  'Goals',
] as const
export type HomeSection = (typeof HOME_SECTIONS)[number]

export const INVESTMENT_TYPES = [
  'Stock',
  'Mutual Fund',
  'ETF',
  'Crypto',
  'FD',
  'Bond',
  'Real Estate',
  'Gold',
  'Other',
] as const
