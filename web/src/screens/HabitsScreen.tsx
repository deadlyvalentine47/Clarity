import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Archive,
  ArchiveRestore,
  BarChart3,
  Check,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { db } from '../db/db'
import type { Habit, HabitFrequency } from '../db/types'
import {
  HABIT_FREQUENCIES,
  WEEKDAY_NAMES,
  archiveHabit,
  computeBestStreak,
  computeStreak,
  habitFrequencyLabel,
  isDeadlinePassedToday,
  isScheduledOn,
  latestMissed,
  softDeleteHabit,
  toggleHabitForDate,
  unarchiveHabit,
} from '../db/habits'
import { formatDateKey, toDateKey } from '../lib/dates'
import { ConfirmDialog, Dialog, EmptyState, Field, PageHeader, Select, TextArea, TextInput } from '../components/ui'

type Filter = 'Today' | 'All' | 'Archived'
const FILTERS: Filter[] = ['Today', 'All', 'Archived']

export default function HabitsScreen() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('Today')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [archiving, setArchiving] = useState<Habit | null>(null)
  const [deleting, setDeleting] = useState<Habit | null>(null)

  const habits = useLiveQuery(async () => db.habits.toArray(), [], [])
  const today = new Date()
  const todayKey = toDateKey(today)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (habits ?? [])
      .filter((h) => (filter === 'Archived' ? h.isArchived && !h.isDeleted : !h.isArchived && !h.isDeleted))
      .filter((h) => !q || h.name.toLowerCase().includes(q) || h.description.toLowerCase().includes(q))
      .filter((h) => filter !== 'Today' || isScheduledOn(h, today))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [habits, query, filter, today])

  return (
    <>
      <PageHeader
        title="Habits"
        subtitle={today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        actions={
          <>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/habits/metrics')}>
              <BarChart3 size={16} /> Metrics
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Habit
            </button>
          </>
        }
      />

      <div className="search" style={{ marginBottom: 10 }}>
        <Search size={18} />
        <input className="input" placeholder="Search habits..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="chip-row" style={{ marginBottom: 14 }}>
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Activity size={40} />}
            title={
              filter === 'Archived'
                ? 'No archived habits'
                : (habits ?? []).length === 0
                  ? 'No habits yet'
                  : 'No habits match your filters'
            }
            subtitle={filter === 'Today' ? 'Nothing scheduled for today — check All.' : 'Tap + to start building habits.'}
            action={
              (habits ?? []).length === 0 ? (
                <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                  <Plus size={16} /> Add habit
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="stack">
          {filtered.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              todayKey={todayKey}
              onOpen={() => navigate(`/habits/${habit.id}`)}
              onEdit={() => setEditing(habit)}
              onArchive={() => setArchiving(habit)}
              onUnarchive={() => void unarchiveHabit(habit.id!)}
              onDelete={() => setDeleting(habit)}
            />
          ))}
        </div>
      )}

      <button className="fab" aria-label="Add habit" onClick={() => setShowAdd(true)}>
        <Plus size={26} />
      </button>

      {showAdd && <HabitDialog onClose={() => setShowAdd(false)} />}
      {editing && <HabitDialog habit={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={archiving != null}
        title="Archive Habit"
        message={`Archive "${archiving?.name}"? Its history stays and it can be restored from the Archived tab.`}
        confirmLabel="Archive"
        onCancel={() => setArchiving(null)}
        onConfirm={async () => {
          if (archiving?.id != null) await archiveHabit(archiving.id)
          setArchiving(null)
        }}
      />
      <ConfirmDialog
        open={deleting != null}
        title="Delete Habit"
        message={`Delete "${deleting?.name}"? It is hidden from the list but its history is kept in the database.`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting?.id != null) await softDeleteHabit(deleting.id)
          setDeleting(null)
        }}
      />
    </>
  )
}

function HabitCard({
  habit,
  todayKey,
  onOpen,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  habit: Habit
  todayKey: string
  onOpen: () => void
  onEdit: () => void
  onArchive: () => void
  onUnarchive: () => void
  onDelete: () => void
}) {
  const [busy, setBusy] = useState(false)
  const isCompleted = habit.completionHistory[todayKey] === true
  const isLate = habit.lateCompletions.includes(todayKey)
  const deadlinePassed = isDeadlinePassedToday(habit)
  const missed = latestMissed(habit)
  const scheduled = isScheduledOn(habit, new Date())

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    try {
      await toggleHabitForDate(habit.id!, todayKey, !isCompleted)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <button
          className="grow"
          style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer', color: 'inherit', minWidth: 0 }}
          onClick={onOpen}
        >
          <div className="bold truncate">{habit.name}</div>
          {habit.description && <div className="small muted truncate">{habit.description}</div>}
          <div className="tiny muted" style={{ marginTop: 2 }}>
            {habitFrequencyLabel(habit)}
            {habit.deadlineHour != null && habit.deadlineMinute != null
              ? ` · Deadline ${String(habit.deadlineHour).padStart(2, '0')}:${String(habit.deadlineMinute).padStart(2, '0')}`
              : ''}
          </div>
          <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
            {isLate && <span className="badge medium">Late ✓</span>}
            {!isLate && missed && <span className="badge high">✗ {missed === todayKey ? 'Today' : formatDateKey(missed)}</span>}
            {deadlinePassed && !isCompleted && <span className="badge medium">Deadline passed</span>}
            {!scheduled && <span className="badge">Not scheduled today</span>}
            {habit.currentStreak > 0 && <span className="badge primary">🔥 {habit.currentStreak} day streak</span>}
          </div>
        </button>

        <div className="icon-actions">
          <button className="icon-btn" aria-label="Edit habit" onClick={onEdit}>
            <Pencil size={17} />
          </button>
          {habit.isArchived ? (
            <button className="icon-btn" aria-label="Unarchive habit" onClick={onUnarchive}>
              <ArchiveRestore size={17} />
            </button>
          ) : (
            <button className="icon-btn" aria-label="Archive habit" onClick={onArchive}>
              <Archive size={17} />
            </button>
          )}
          <button className="icon-btn" aria-label="Delete habit" onClick={onDelete}>
            <Trash2 size={17} color="var(--error)" />
          </button>
          {!habit.isArchived && (
            <button
              className={`status-dot ${isCompleted ? (isLate ? 'late' : 'done') : 'warning'}`}
              style={{ width: 36, height: 36 }}
              aria-label={isCompleted ? 'Mark not done' : 'Mark done'}
              aria-pressed={isCompleted}
              onClick={() => void toggle()}
              disabled={busy}
            >
              <Check size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function HabitDialog({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const [name, setName] = useState(habit?.name ?? '')
  const [description, setDescription] = useState(habit?.description ?? '')
  const [frequency, setFrequency] = useState<HabitFrequency>(habit?.frequency ?? 'Daily')
  const [alternateDays, setAlternateDays] = useState(habit?.alternateDays != null ? String(habit.alternateDays) : '1')
  const [selectedDays, setSelectedDays] = useState<number[]>(habit?.selectedDays ?? [])
  const [deadlineEnabled, setDeadlineEnabled] = useState(habit?.deadlineHour != null && habit?.deadlineMinute != null)
  const [deadlineHour, setDeadlineHour] = useState(habit?.deadlineHour != null ? String(habit.deadlineHour) : '21')
  const [deadlineMinute, setDeadlineMinute] = useState(habit?.deadlineMinute != null ? String(habit.deadlineMinute) : '0')

  const alternateValue = Number(alternateDays)
  const hourValue = Number(deadlineHour)
  const minuteValue = Number(deadlineMinute)
  const valid =
    name.trim() !== '' &&
    (frequency !== 'Alternate' || (Number.isInteger(alternateValue) && alternateValue >= 1)) &&
    (frequency !== 'Custom' || selectedDays.length > 0) &&
    (!deadlineEnabled || (Number.isInteger(hourValue) && hourValue >= 0 && hourValue <= 23 && Number.isInteger(minuteValue) && minuteValue >= 0 && minuteValue <= 59))

  const save = async () => {
    if (!valid) return
    const payload: Partial<Habit> = {
      name: name.trim(),
      description: description.trim(),
      frequency,
      alternateDays: frequency === 'Alternate' ? alternateValue : null,
      selectedDays: frequency === 'Custom' ? [...selectedDays].sort((a, b) => a - b) : null,
      deadlineHour: deadlineEnabled ? hourValue : null,
      deadlineMinute: deadlineEnabled ? minuteValue : null,
    }
    if (habit?.id != null) {
      const next = { ...habit, ...payload } as Habit
      await db.habits.update(habit.id, {
        ...payload,
        currentStreak: computeStreak(next),
        bestStreak: Math.max(habit.bestStreak, computeBestStreak(next)),
      })
    } else {
      const now = Date.now()
      const created: Habit = {
        name: payload.name!,
        description: payload.description!,
        frequency,
        alternateDays: payload.alternateDays ?? null,
        selectedDays: payload.selectedDays ?? null,
        targetCount: 1,
        currentStreak: 0,
        bestStreak: 0,
        completionHistory: {},
        lateCompletions: [],
        reminderTime: null,
        isArchived: false,
        archivedAt: null,
        isDeleted: false,
        deletedAt: null,
        deadlineHour: payload.deadlineHour ?? null,
        deadlineMinute: payload.deadlineMinute ?? null,
        dailyNotes: {},
        createdAt: now,
      }
      await db.habits.add(created)
    }
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={habit ? 'Edit Habit' : 'Add Habit'}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!valid}>{habit ? 'Save' : 'Add'}</button>
        </div>
      }
    >
      <div className="stack">
        <Field label="Habit name *">
          <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Read 20 pages" />
        </Field>
        <Field label="Description">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" style={{ minHeight: 70 }} />
        </Field>
        <Field label="Frequency">
          <Select value={frequency} onChange={(e) => setFrequency(e.target.value as HabitFrequency)}>
            {HABIT_FREQUENCIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </Select>
        </Field>

        {frequency === 'Alternate' && (
          <Field label="Skip days between (1 = every other day) *">
            <TextInput type="number" inputMode="numeric" min={1} value={alternateDays} onChange={(e) => setAlternateDays(e.target.value)} />
          </Field>
        )}

        {frequency === 'Custom' && (
          <Field label="Days *">
            <div className="pill-list">
              {WEEKDAY_NAMES.map((label, i) => {
                const day = i + 1
                const active = selectedDays.includes(day)
                return (
                  <button
                    key={label}
                    className={`chip ${active ? 'active' : ''}`}
                    onClick={() => setSelectedDays((prev) => active ? prev.filter((d) => d !== day) : [...prev, day])}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </Field>
        )}

        <div className="row-between">
          <span className="label">Deadline</span>
          <button
            className={`switch ${deadlineEnabled ? 'on' : ''}`}
            aria-label="Enable deadline"
            aria-pressed={deadlineEnabled}
            onClick={() => setDeadlineEnabled((v) => !v)}
          />
        </div>

        {deadlineEnabled && (
          <div className="row">
            <Field label="Hour (0–23)">
              <TextInput type="number" inputMode="numeric" min={0} max={23} value={deadlineHour} onChange={(e) => setDeadlineHour(e.target.value)} />
            </Field>
            <Field label="Minute (0–59)">
              <TextInput type="number" inputMode="numeric" min={0} max={59} value={deadlineMinute} onChange={(e) => setDeadlineMinute(e.target.value)} />
            </Field>
          </div>
        )}
        <p className="tiny muted">
          Weekly repeats every 7 days from creation, Monthly on the same day-of-month, and completing after the
          deadline is recorded as late.
        </p>
      </div>
    </Dialog>
  )
}
