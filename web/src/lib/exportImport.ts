// Port of util/DataExportImport.kt, extended for the phase-2 schema.
// Backups stay compatible with the Android app: extra fields (darkMode, links)
// are ignored by its kotlinx.serialization `ignoreUnknownKeys = true` config.
import { db } from '../db/db'
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
  PomodoroFocusSession,
  PomodoroSession,
  Source,
  Subtask,
  Task,
  Transaction,
} from '../db/types'
import { HOME_SECTIONS, type HomeSection, type ThemeMode } from '../db/types'
import { normalizePreferences, type Preferences } from './prefs'

export interface BackupSettings {
  username: string
  theme: string
  darkMode: ThemeMode
  sectionOrder: string[]
  sectionEnabled: string[]
}

export interface AppData {
  tasks: Task[]
  habits: Habit[]
  notes: Note[]
  transactions: Transaction[]
  goals: Goal[]
  events: Event[]
  categories: Category[]
  sources: Source[]
  noteCategories: NoteCategory[]
  budgetLimits: BudgetLimit[]
  subtasks: Subtask[]
  pomodoroSessions: PomodoroSession[]
  pomodoroFocusSessions: PomodoroFocusSession[]
  creditCards: CreditCard[]
  creditCardTransactions: CreditCardTransaction[]
  investments: Investment[]
  dayJournals: DayJournal[]
  settings: BackupSettings
}

export async function exportData(prefs: Preferences): Promise<string> {
  const [
    tasks,
    habits,
    notes,
    transactions,
    goals,
    events,
    categories,
    sources,
    noteCategories,
    budgetLimits,
    subtasks,
    pomodoroSessions,
    pomodoroFocusSessions,
    creditCards,
    creditCardTransactions,
    investments,
    dayJournals,
  ] = await Promise.all([
    db.tasks.toArray(),
    db.habits.toArray(),
    db.notes.toArray(),
    db.transactions.toArray(),
    db.goals.toArray(),
    db.events.toArray(),
    db.categories.toArray(),
    db.sources.toArray(),
    db.noteCategories.toArray(),
    db.budgetLimits.toArray(),
    db.subtasks.toArray(),
    db.pomodoroSessions.toArray(),
    db.pomodoroFocusSessions.toArray(),
    db.creditCards.toArray(),
    db.creditCardTransactions.toArray(),
    db.investments.toArray(),
    db.dayJournals.toArray(),
  ])

  const data: AppData = {
    tasks,
    habits,
    notes,
    transactions,
    goals,
    events,
    categories,
    sources,
    noteCategories,
    budgetLimits,
    subtasks,
    pomodoroSessions,
    pomodoroFocusSessions,
    creditCards,
    creditCardTransactions,
    investments,
    dayJournals,
    settings: {
      username: prefs.username,
      theme: prefs.theme,
      darkMode: prefs.darkMode,
      sectionOrder: prefs.sectionOrder,
      sectionEnabled: prefs.sectionEnabled,
    },
  }
  return JSON.stringify(data, null, 2)
}

const arr = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

function habitDefaults(h: Partial<Habit>): Habit {
  return {
    name: String(h.name ?? 'Habit'),
    description: String(h.description ?? ''),
    frequency: (h.frequency as Habit['frequency']) ?? 'Daily',
    alternateDays: h.alternateDays ?? null,
    selectedDays: Array.isArray(h.selectedDays) ? h.selectedDays : null,
    targetCount: Number(h.targetCount ?? 1),
    currentStreak: Number(h.currentStreak ?? 0),
    bestStreak: Number(h.bestStreak ?? 0),
    completionHistory:
      h.completionHistory && typeof h.completionHistory === 'object' ? h.completionHistory : {},
    lateCompletions: Array.isArray(h.lateCompletions) ? h.lateCompletions : [],
    reminderTime: h.reminderTime ?? null,
    isArchived: Boolean(h.isArchived),
    archivedAt: h.archivedAt ?? null,
    isDeleted: Boolean(h.isDeleted),
    deletedAt: h.deletedAt ?? null,
    deadlineHour: h.deadlineHour ?? null,
    deadlineMinute: h.deadlineMinute ?? null,
    dailyNotes: h.dailyNotes && typeof h.dailyNotes === 'object' ? h.dailyNotes : {},
    createdAt: Number(h.createdAt ?? Date.now()),
  }
}

export interface ImportResult {
  preferences: Preferences
  counts: Record<string, number>
}

/**
 * Full replace, atomic. Every table is cleared and re-inserted inside one
 * Dexie transaction; parent/child IDs are remapped (subtasks, notes, cards,
 * pomodoro task links, bill-payment links).
 */
export async function importData(jsonText: string): Promise<ImportResult> {
  const raw = JSON.parse(jsonText) as Partial<AppData> & Record<string, unknown>
  if (!raw || typeof raw !== 'object') throw new Error('Invalid backup file')

  const counts: Record<string, number> = {}

  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      // Backups never contain binary note images (same as Android, where they
      // live as files), so keep whatever is already stored locally instead of
      // orphaning every ![img:…] marker in the imported notes.
      if (table === db.noteImages) continue
      await table.clear()
    }

    const taskMap = new Map<number, number>()
    for (const task of arr<Task>(raw.tasks)) {
      const { id: oldId, ...rest } = task
      const newId = (await db.tasks.add({
        ...rest,
        tags: Array.isArray(rest.tags) ? rest.tags : [],
        description: rest.description ?? '',
        createdAt: rest.createdAt ?? Date.now(),
        updatedAt: rest.updatedAt ?? Date.now(),
      })) as number
      if (oldId != null) taskMap.set(oldId, newId)
    }
    counts.tasks = taskMap.size

    for (const subtask of arr<Subtask>(raw.subtasks)) {
      const taskId = taskMap.get(subtask.taskId)
      if (taskId == null) continue
      await db.subtasks.add({
        taskId,
        title: subtask.title,
        isCompleted: Boolean(subtask.isCompleted),
        createdAt: subtask.createdAt ?? Date.now(),
      })
    }

    const cardMap = new Map<number, number>()
    for (const card of arr<CreditCard>(raw.creditCards)) {
      const { id: oldId, ...rest } = card
      const newId = (await db.creditCards.add({
        name: rest.name,
        creditLimit: Number(rest.creditLimit ?? 0),
        billingCycleDay: Number(rest.billingCycleDay ?? 1),
        createdAt: rest.createdAt ?? Date.now(),
      })) as number
      if (oldId != null) cardMap.set(oldId, newId)
    }
    counts.creditCards = cardMap.size

    const txnMap = new Map<number, number>()
    for (const txn of arr<Transaction>(raw.transactions)) {
      const { id: oldId, ...rest } = txn
      const newId = (await db.transactions.add({
        ...rest,
        isRecurring: Boolean(rest.isRecurring),
        recurringType: rest.recurringType ?? null,
        createdAt: rest.createdAt ?? Date.now(),
        linkedCardTxnId: null,
      })) as number
      if (oldId != null) txnMap.set(oldId, newId)
    }
    counts.transactions = txnMap.size

    const cardTxnMap = new Map<number, number>()
    for (const txn of arr<CreditCardTransaction>(raw.creditCardTransactions)) {
      const cardId = cardMap.get(txn.cardId)
      if (cardId == null) continue
      const { id: oldId, ...rest } = txn
      const newId = (await db.creditCardTransactions.add({
        cardId,
        amount: Number(rest.amount ?? 0),
        description: rest.description ?? '',
        date: rest.date ?? Date.now(),
        type: rest.type ?? 'Purchase',
        createdAt: rest.createdAt ?? Date.now(),
        linkedTransactionId: null,
      })) as number
      if (oldId != null) cardTxnMap.set(oldId, newId)
    }
    counts.creditCardTransactions = cardTxnMap.size

    // Re-link bill payments now that both sides have their new IDs.
    for (const txn of arr<Transaction>(raw.transactions)) {
      if (txn.id == null || txn.linkedCardTxnId == null) continue
      const newTxnId = txnMap.get(txn.id)
      const newCardTxnId = cardTxnMap.get(txn.linkedCardTxnId)
      if (newTxnId != null && newCardTxnId != null) {
        await db.transactions.update(newTxnId, { linkedCardTxnId: newCardTxnId })
      }
    }
    for (const txn of arr<CreditCardTransaction>(raw.creditCardTransactions)) {
      if (txn.id == null || txn.linkedTransactionId == null) continue
      const newCardTxnId = cardTxnMap.get(txn.id)
      const newTxnId = txnMap.get(txn.linkedTransactionId)
      if (newCardTxnId != null && newTxnId != null) {
        await db.creditCardTransactions.update(newCardTxnId, { linkedTransactionId: newTxnId })
      }
    }

    const noteMap = new Map<number, number>()
    for (const note of arr<Note>(raw.notes)) {
      const { id: oldId, ...rest } = note
      const newId = (await db.notes.add({
        title: rest.title ?? 'Untitled',
        content: rest.content ?? '',
        isPinned: Boolean(rest.isPinned),
        category: rest.category ?? '',
        parentNoteId: null,
        sortOrder: Number(rest.sortOrder ?? 0),
        createdAt: rest.createdAt ?? Date.now(),
        updatedAt: rest.updatedAt ?? Date.now(),
      })) as number
      if (oldId != null) noteMap.set(oldId, newId)
    }
    for (const note of arr<Note>(raw.notes)) {
      if (note.id == null || note.parentNoteId == null) continue
      const newId = noteMap.get(note.id)
      const parentId = noteMap.get(note.parentNoteId)
      if (newId != null && parentId != null) await db.notes.update(newId, { parentNoteId: parentId })
    }
    counts.notes = noteMap.size

    for (const habit of arr<Habit>(raw.habits)) {
      const { id: _id, ...rest } = habit
      await db.habits.add(habitDefaults(rest))
    }
    counts.habits = arr<Habit>(raw.habits).length

    for (const category of arr<Category>(raw.categories)) {
      const { id: _id, ...rest } = category
      await db.categories.add({ name: rest.name, isDefault: Boolean(rest.isDefault), createdAt: rest.createdAt ?? Date.now() })
    }

    for (const source of arr<Source>(raw.sources)) {
      const { id: _id, ...rest } = source
      await db.sources.add({
        name: rest.name,
        balance: Number(rest.balance ?? 0),
        isDefault: Boolean(rest.isDefault),
        createdAt: rest.createdAt ?? Date.now(),
      })
    }

    for (const category of arr<NoteCategory>(raw.noteCategories)) {
      const { id: _id, ...rest } = category
      await db.noteCategories.add({ name: rest.name, createdAt: rest.createdAt ?? Date.now() })
    }

    for (const limit of arr<BudgetLimit>(raw.budgetLimits)) {
      const { id: _id, ...rest } = limit
      await db.budgetLimits.add(rest)
    }

    for (const goal of arr<Goal>(raw.goals)) {
      const { id: _id, ...rest } = goal
      await db.goals.add({
        ...rest,
        milestones: Array.isArray(rest.milestones) ? rest.milestones : [],
        completedMilestones: Array.isArray(rest.completedMilestones) ? rest.completedMilestones : [],
      })
    }

    for (const event of arr<Event>(raw.events)) {
      const { id: _id, ...rest } = event
      await db.events.add(rest)
    }

    for (const session of arr<PomodoroFocusSession>(raw.pomodoroFocusSessions)) {
      const { id: _id, ...rest } = session
      await db.pomodoroFocusSessions.add(rest)
    }

    for (const session of arr<PomodoroSession>(raw.pomodoroSessions)) {
      const { id: _id, ...rest } = session
      await db.pomodoroSessions.add({
        ...rest,
        taskId: rest.taskId != null ? taskMap.get(rest.taskId) ?? null : null,
        distractions: Array.isArray(rest.distractions) ? rest.distractions : [],
      })
    }

    for (const investment of arr<Investment>(raw.investments)) {
      const { id: _id, ...rest } = investment
      await db.investments.add(rest)
    }

    for (const journal of arr<DayJournal>(raw.dayJournals)) {
      if (!journal?.date) continue
      await db.dayJournals.put({
        date: journal.date,
        content: journal.content ?? '',
        updatedAt: journal.updatedAt ?? Date.now(),
      })
    }
  })

  const settings = (raw.settings ?? {}) as Partial<BackupSettings>
  const preferences = normalizePreferences({
    username: settings.username ?? '',
    theme: settings.theme ?? 'Ocean',
    darkMode: settings.darkMode ?? 'system',
    sectionOrder: (settings.sectionOrder ?? [...HOME_SECTIONS]) as HomeSection[],
    sectionEnabled: (settings.sectionEnabled ?? [...HOME_SECTIONS]) as HomeSection[],
  })

  return { preferences, counts }
}

export function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
