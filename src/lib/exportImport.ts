// Port of util/DataExportImport.kt, extended for the phase-2 schema.
// Backups stay compatible with the Android app: extra fields (darkMode, links)
// are ignored by its kotlinx.serialization `ignoreUnknownKeys = true` config.
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
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
  HabitGroup,
  Investment,
  Note,
  NoteCategory,
  RunGroup,
  RunSession,
  Source,
  Transaction,
} from '../db/types'
import { HOME_SECTIONS, type DistanceUnit, type HomeSection, type ThemeMode } from '../db/types'
import { eventDefaults } from '../db/events'
import { saveFileToDevice } from './native'
import { normalizePreferences, type Preferences } from './prefs'

export interface BackupSettings {
  username: string
  theme: string
  darkMode: ThemeMode
  sectionOrder: string[]
  sectionEnabled: string[]
  distanceUnit?: DistanceUnit
}

/** Note pictures travel as data URLs so a backup is self-contained. */
export interface ExportedImage {
  id: string
  data: string
  createdAt: number
}

export interface AppData {
  habits: Habit[]
  /** optional: backups from before habit groups have none */
  habitGroups?: HabitGroup[]
  notes: Note[]
  transactions: Transaction[]
  goals: Goal[]
  events: Event[]
  categories: Category[]
  sources: Source[]
  noteCategories: NoteCategory[]
  budgetLimits: BudgetLimit[]
  creditCards: CreditCard[]
  creditCardTransactions: CreditCardTransaction[]
  investments: Investment[]
  dayJournals: DayJournal[]
  /** optional: backups from before the Runs feature have none */
  runs?: RunSession[]
  /** optional: backups from before run sessions have none */
  runGroups?: RunGroup[]
  noteImages?: ExportedImage[]
  settings: BackupSettings
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image'))
    reader.readAsDataURL(blob)
  })
}

// SVG is deliberately excluded: it can carry script if ever rendered directly.
const SAFE_IMAGE_TYPE = /^image\/(png|jpeg|jpg|gif|webp|bmp|avif)$/

function dataUrlToBlob(data: string): Blob | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(data)
  if (!match) return null
  // Never trust the MIME type from a backup beyond a small image allowlist.
  const declared = (match[1] || 'image/jpeg').toLowerCase()
  const type = SAFE_IMAGE_TYPE.test(declared) ? declared : 'image/jpeg'
  try {
    if (match[2]) {
      const binary = atob(match[3])
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
      return new Blob([bytes], { type })
    }
    return new Blob([decodeURIComponent(match[3])], { type })
  } catch {
    return null
  }
}

export async function exportData(prefs: Preferences): Promise<string> {
  const [
    habits,
    habitGroups,
    notes,
    transactions,
    goals,
    events,
    categories,
    sources,
    noteCategories,
    budgetLimits,
    creditCards,
    creditCardTransactions,
    investments,
    dayJournals,
    runs,
    runGroups,
    noteImages,
  ] = await Promise.all([
    db.habits.toArray(),
    db.habitGroups.toArray(),
    db.notes.toArray(),
    db.transactions.toArray(),
    db.goals.toArray(),
    db.events.toArray(),
    db.categories.toArray(),
    db.sources.toArray(),
    db.noteCategories.toArray(),
    db.budgetLimits.toArray(),
    db.creditCards.toArray(),
    db.creditCardTransactions.toArray(),
    db.investments.toArray(),
    db.dayJournals.toArray(),
    db.runs.toArray(),
    db.runGroups.toArray(),
    db.noteImages.toArray(),
  ])

  const data: AppData = {
    habits,
    habitGroups,
    notes,
    transactions,
    goals,
    events,
    categories,
    sources,
    noteCategories,
    budgetLimits,
    creditCards,
    creditCardTransactions,
    investments,
    dayJournals,
    runs,
    runGroups,
    noteImages: await Promise.all(
      noteImages.map(async (image) => ({
        id: image.id,
        data: await blobToDataUrl(image.blob),
        createdAt: image.createdAt,
      })),
    ),
    settings: {
      username: prefs.username,
      theme: prefs.theme,
      darkMode: prefs.darkMode,
      sectionOrder: prefs.sectionOrder,
      sectionEnabled: prefs.sectionEnabled,
      distanceUnit: prefs.distanceUnit,
    },
  }
  // Compact: a backup with note images is large enough without indentation.
  return JSON.stringify(data)
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
    sortOrder: Number(h.sortOrder ?? 0),
    groupId: h.groupId ?? null,
    createdAt: Number(h.createdAt ?? Date.now()),
  }
}

export interface ImportResult {
  preferences: Preferences
  counts: Record<string, number>
}

/**
 * Full replace, atomic. Every table is cleared and re-inserted inside one
 * Dexie transaction; parent/child IDs are remapped (notes, cards,
 * bill-payment links).
 */
// A backup with note images can be large, but parsing an unbounded file would
// freeze or crash the WebView before the try/catch can help.
const MAX_BACKUP_CHARS = 50 * 1024 * 1024

export async function importData(jsonText: string): Promise<ImportResult> {
  if (jsonText.length > MAX_BACKUP_CHARS) {
    throw new Error('Backup file is too large (max 50 MB)')
  }
  const raw = JSON.parse(jsonText) as Partial<AppData> & Record<string, unknown>
  if (!raw || typeof raw !== 'object') throw new Error('Invalid backup file')

  const counts: Record<string, number> = {}

  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      // Images are not cleared: a backup from the old Kotlin app has none (its
      // pictures were files in clarity/pics), and wiping local ones would
      // orphan every ![img:…] marker. Images inside the backup are merged in
      // below, keyed by uuid.
      if (table === db.noteImages) continue
      await table.clear()
    }

    const images = arr<ExportedImage>(raw.noteImages)
    let restoredImages = 0
    for (const image of images) {
      if (!image || typeof image.id !== 'string' || typeof image.data !== 'string') continue
      const blob = dataUrlToBlob(image.data)
      if (!blob) continue
      await db.noteImages.put({
        id: image.id,
        blob,
        createdAt: Number(image.createdAt ?? Date.now()),
      })
      restoredImages += 1
    }
    if (images.length > 0) counts.noteImages = restoredImages

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

    const groupMap = new Map<number, number>()
    for (const group of arr<HabitGroup>(raw.habitGroups)) {
      const { id: oldId, ...rest } = group
      const newId = (await db.habitGroups.add({
        name: rest.name ?? 'Group',
        sortOrder: Number(rest.sortOrder ?? 0),
        isCollapsed: rest.isCollapsed ?? true,
        createdAt: rest.createdAt ?? Date.now(),
      })) as number
      if (oldId != null) groupMap.set(oldId, newId)
    }
    counts.habitGroups = groupMap.size

    for (const habit of arr<Habit>(raw.habits)) {
      const { id: _id, ...rest } = habit
      const defaults = habitDefaults(rest)
      await db.habits.add({
        ...defaults,
        groupId: habit.groupId != null ? groupMap.get(habit.groupId) ?? null : null,
      })
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
      await db.events.add(eventDefaults(rest))
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

    const runGroupMap = new Map<number, number>()
    for (const group of arr<RunGroup>(raw.runGroups)) {
      const { id: oldId, ...rest } = group
      const newId = (await db.runGroups.add({
        name: rest.name?.trim() || 'Session',
        sortOrder: typeof rest.sortOrder === 'number' ? rest.sortOrder : null,
        isCollapsed: Boolean(rest.isCollapsed),
        createdAt: Number(rest.createdAt ?? Date.now()),
      })) as number
      if (oldId != null) runGroupMap.set(oldId, newId)
    }
    counts.runGroups = runGroupMap.size

    for (const run of arr<RunSession>(raw.runs)) {
      const { id: _id, ...rest } = run
      await db.runs.add({
        name: rest.name ?? '',
        startedAt: Number(rest.startedAt ?? Date.now()),
        endedAt: rest.endedAt == null ? null : Number(rest.endedAt),
        durationSeconds: Math.max(0, Number(rest.durationSeconds ?? 0)),
        distanceMeters: Math.max(0, Number(rest.distanceMeters ?? 0)),
        isManualDistance: Boolean(rest.isManualDistance),
        points: Array.isArray(rest.points)
          ? rest.points.filter(
              (point) =>
                point != null &&
                Number.isFinite(point.lat) &&
                Number.isFinite(point.lng) &&
                Number.isFinite(point.t),
            )
          : [],
        notes: rest.notes ?? '',
        groupId: rest.groupId != null ? (runGroupMap.get(rest.groupId) ?? null) : null,
        sortOrder: typeof rest.sortOrder === 'number' ? rest.sortOrder : null,
        createdAt: Number(rest.createdAt ?? Date.now()),
      })
    }
    counts.runs = arr<RunSession>(raw.runs).length
  })

  const settings = (raw.settings ?? {}) as Partial<BackupSettings>
  const preferences = normalizePreferences({
    username: settings.username ?? '',
    theme: settings.theme ?? 'Ocean',
    darkMode: settings.darkMode ?? 'system',
    sectionOrder: (settings.sectionOrder ?? [...HOME_SECTIONS]) as HomeSection[],
    sectionEnabled: (settings.sectionEnabled ?? [...HOME_SECTIONS]) as HomeSection[],
    distanceUnit: settings.distanceUnit,
  })

  return { preferences, counts }
}

export function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the browser has had a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Write the backup to the app cache. On native this is the file the "Save as"
 * picker copies and the share sheet attaches, so the payload is written once,
 * up front, instead of being carried through a plugin call.
 */
async function writeExportToCache(filename: string, json: string): Promise<string> {
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: json,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  })
  return uri
}

function describeWrite(result: { bytes: number; location: string }, json: string): string {
  const expected = new Blob([json]).size
  const where = result.location || 'the chosen location'
  if (result.bytes === expected) return `Saved to ${where}`
  return `Only ${result.bytes} of ${expected} bytes were written to ${where} — try Share instead`
}

/**
 * "Save to device": the system picker (Android SAF, iOS Files) or a browser
 * download. Returns a short status message for the settings row.
 */
export async function exportToDevice(filename: string, json: string): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    downloadJson(filename, json)
    return 'Downloaded'
  }

  const uri = await writeExportToCache(filename, json)
  const result = await saveFileToDevice(filename, uri)
  if (!result) return 'Export cancelled'
  return describeWrite(result, json)
}

/** "Share": hand the cached file to another app (Files, Drive, email…). */
export async function shareExport(filename: string, json: string): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    downloadJson(filename, json)
    return 'Downloaded'
  }

  const uri = await writeExportToCache(filename, json)
  await Share.share({
    title: filename,
    files: [uri],
    dialogTitle: 'Share Clarity backup',
  })
  return 'Backup ready to share'
}
