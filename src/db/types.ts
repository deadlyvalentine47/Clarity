// Types mirror the Room entities in app/src/main/java/com/clarity/app/data/local/database.

export type Priority = 'High' | 'Medium' | 'Low'
export type RecurringType = 'Daily' | 'Weekly' | 'Monthly' | 'Custom'
export type GoalType = 'Short-term' | 'Long-term'
export type HabitFrequency = 'Daily' | 'Weekly' | 'Monthly' | 'Alternate' | 'Custom'
export type TransactionType = 'Income' | 'Expense'
export type PomodoroType = 'Focus' | 'ShortBreak' | 'LongBreak'
export type CardTxnType = 'Purchase' | 'Payment' | 'Credit'
export type ThemeMode = 'system' | 'light' | 'dark'

export interface Task {
  id?: number
  title: string
  description: string
  priority: Priority
  category: string
  tags: string[]
  dueDate: number | null
  reminderTime: number | null
  isCompleted: boolean
  isRecurring: boolean
  recurringType: RecurringType | null
  createdAt: number
  updatedAt: number
}

export interface Subtask {
  id?: number
  taskId: number
  title: string
  isCompleted: boolean
  createdAt: number
}

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

export interface Goal {
  id?: number
  title: string
  description: string
  type: GoalType
  progress: number // 0..1
  targetDate: number | null
  milestones: string[]
  completedMilestones: string[]
  isCompleted: boolean
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
  createdAt: number
}

export interface PomodoroFocusSession {
  id?: number
  title: string
  focusDurationMinutes: number
  breakDurationMinutes: number
  sessionCount: number
  totalFocusMinutes: number
  distractions: string
  createdAt: number
  updatedAt: number
}

export interface PomodoroSession {
  id?: number
  taskId: number | null
  duration: number
  type: PomodoroType
  completedAt: number
  distractions: string[]
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

export const HOME_SECTIONS = [
  'Tasks',
  'Events',
  'Habits',
  'Budget',
  'Notes',
  'Goals',
  'Pomodoro',
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
