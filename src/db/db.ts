import Dexie, { type Table } from 'dexie'
import type {
  BudgetLimit,
  Category,
  CreditCard,
  CreditCardTransaction,
  DayJournal,
  Event,
  Goal,
  Habit,
  Investment,
  Note,
  NoteCategory,
  NoteImage,
  PomodoroFocusSession,
  PomodoroSession,
  Source,
  Subtask,
  Task,
  Transaction,
} from './types'

export class ClarityDB extends Dexie {
  tasks!: Table<Task, number>
  subtasks!: Table<Subtask, number>
  habits!: Table<Habit, number>
  notes!: Table<Note, number>
  noteCategories!: Table<NoteCategory, number>
  noteImages!: Table<NoteImage, string>
  transactions!: Table<Transaction, number>
  categories!: Table<Category, number>
  sources!: Table<Source, number>
  budgetLimits!: Table<BudgetLimit, number>
  goals!: Table<Goal, number>
  events!: Table<Event, number>
  pomodoroSessions!: Table<PomodoroSession, number>
  pomodoroFocusSessions!: Table<PomodoroFocusSession, number>
  creditCards!: Table<CreditCard, number>
  creditCardTransactions!: Table<CreditCardTransaction, number>
  investments!: Table<Investment, number>
  dayJournals!: Table<DayJournal, string>

  constructor() {
    super('clarity')

    // v1 was the first web port. Kept so existing browser data upgrades in place.
    this.version(1).stores({
      tasks: '++id, dueDate, priority, category, createdAt',
      subtasks: '++id, taskId, createdAt',
      habits: '++id, createdAt',
      notes: '++id, category, updatedAt',
      noteCategories: '++id, name',
      transactions: '++id, type, category, source, date, createdAt',
      categories: '++id, name',
      sources: '++id, name',
      budgetLimits: '++id, [category+month+year], month, year',
      goals: '++id, targetDate, createdAt',
      events: '++id, startDate, category',
      pomodoroSessions: '++id, completedAt, type',
      pomodoroFocusSessions: '++id, updatedAt',
    })

    // v2 mirrors Android DB version 17 (credit cards, investments, journals,
    // habit scheduling/deadline/notes, notes tree). Booleans stay unindexed.
    this.version(2)
      .stores({
        tasks: '++id, dueDate, priority, category, createdAt',
        subtasks: '++id, taskId, createdAt',
        habits: '++id, createdAt, archivedAt',
        notes: '++id, category, updatedAt, parentNoteId, sortOrder',
        noteCategories: '++id, name',
        noteImages: 'id',
        transactions: '++id, type, category, source, date, createdAt',
        categories: '++id, name',
        sources: '++id, name',
        budgetLimits: '++id, [category+month+year], month, year',
        goals: '++id, targetDate, createdAt',
        events: '++id, startDate, category',
        pomodoroSessions: '++id, completedAt, type',
        pomodoroFocusSessions: '++id, updatedAt',
        creditCards: '++id, createdAt',
        creditCardTransactions: '++id, cardId, date, type',
        investments: '++id, purchaseDate, type',
        dayJournals: 'date',
      })
      .upgrade(async (tx) => {
        await tx
          .table('habits')
          .toCollection()
          .modify((h: Habit) => {
            h.lateCompletions ??= []
            h.dailyNotes ??= {}
            h.isDeleted ??= false
            h.deletedAt ??= null
            h.archivedAt ??= null
            h.alternateDays ??= null
            h.selectedDays ??= null
            h.deadlineHour ??= null
            h.deadlineMinute ??= null
            h.bestStreak ??= 0
          })
        await tx
          .table('notes')
          .toCollection()
          .modify((n: Note) => {
            n.parentNoteId ??= null
            n.sortOrder ??= 0
          })
        await tx
          .table('sources')
          .toCollection()
          .modify((s: Source) => {
            s.balance ??= 0
          })
      })

    // v3 adds manual habit ordering. Seed existing habits from creation order
    // so the list doesn't jump around after the upgrade.
    this.version(3)
      .stores({
        habits: '++id, createdAt, archivedAt',
      })
      .upgrade(async (tx) => {
        const habits = await tx.table('habits').toArray()
        habits.sort(
          (a: Habit, b: Habit) => a.createdAt - b.createdAt || (a.id ?? 0) - (b.id ?? 0),
        )
        for (let i = 0; i < habits.length; i += 1) {
          await tx.table('habits').update(habits[i].id, { sortOrder: (i + 1) * 10 })
        }
      })
  }
}

export const db = new ClarityDB()

/**
 * Wipe every table (Settings → Data → Clear data). Preferences live in
 * localStorage and are deliberately untouched, so the name and theme stay.
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
  })
}
