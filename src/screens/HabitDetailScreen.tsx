import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, BarChart3, Pencil, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import type { Habit } from '../db/types'
import {
  completeHabitLate,
  habitCreatedDate,
  habitEndDate,
  habitFrequencyLabel,
  isScheduledOn,
  setHabitMissed,
  setHabitPending,
  setHabitSkipped,
  toggleHabitForDate,
  updateHabitDailyNote,
} from '../db/habits'
import { addDays, formatDateKey, isoWeekday, toDateKey } from '../lib/dates'
import { stripMarkdownForSnippet } from '../lib/markdown'
import { plural } from '../lib/format'
import { ConfirmDialog, Dialog, EmptyState, PageHeader, Segmented, TextArea } from '../components/ui'
import { HabitDialog } from './HabitsScreen'

type Period = 'Weekly' | 'Monthly'

interface DayStatus {
  date: Date
  key: string
  scheduled: boolean
  state: 'done' | 'late' | 'missed' | 'skipped' | 'warning' | 'pending' | 'off' | 'future'
}

function statusFor(habit: Habit, date: Date, today: Date): DayStatus {
  const key = toDateKey(date)
  const created = habitCreatedDate(habit)
  const end = habitEndDate(habit)
  const scheduled = isScheduledOn(habit, date)
  const todayKey = toDateKey(today)
  const isFuture = key > todayKey
  const done = habit.completionHistory[key] === true
  const late = habit.lateCompletions.includes(key)
  const skipped = habit.skippedDates?.[key] === true
  const missed = habit.completionHistory[key] === false

  let state: DayStatus['state'] = 'off'
  if (date < created || (end && date > end) || !scheduled) state = 'off'
  else if (done) state = late ? 'late' : 'done'
  else if (skipped) state = 'skipped'
  else if (missed) state = 'missed'
  else if (isFuture) state = 'future'
  else if (habit.isArchived || habit.isDeleted) state = 'warning'
  else state = 'pending'
  return { date, key, scheduled, state }
}

export default function HabitDetailScreen() {
  const { habitId } = useParams()
  const id = Number(habitId)
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('Weekly')
  const [selected, setSelected] = useState<DayStatus | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const habit = useLiveQuery(async () => (id ? ((await db.habits.get(id)) ?? null) : null), [id])

  const weeks = useMemo(() => {
    if (!habit) return []
    const created = habitCreatedDate(habit)
    const today = new Date()
    const start = addDays(created, -((isoWeekday(created) - 1) % 7))
    const end = addDays(today, 7)
    const rows: DayStatus[][] = []
    let cursor = new Date(start)
    while (cursor <= end && rows.length < 260) {
      const row: DayStatus[] = []
      for (let i = 0; i < 7; i++) row.push(statusFor(habit, addDays(cursor, i), today))
      rows.push(row)
      cursor = addDays(cursor, 7)
    }
    return rows
  }, [habit])

  const months = useMemo(() => {
    if (!habit) return []
    const created = habitCreatedDate(habit)
    const today = new Date()
    const out: { label: string; cells: (DayStatus | null)[] }[] = []
    let cursor = new Date(created.getFullYear(), created.getMonth(), 1)
    let guard = 0
    while (cursor <= today && guard < 120) {
      guard++
      const year = cursor.getFullYear()
      const month = cursor.getMonth()
      const firstWeekday = new Date(year, month, 1).getDay()
      const days = new Date(year, month + 1, 0).getDate()
      const cells: (DayStatus | null)[] = []
      for (let i = 0; i < firstWeekday; i++) cells.push(null)
      for (let d = 1; d <= days; d++) cells.push(statusFor(habit, new Date(year, month, d, 12), today))
      while (cells.length % 7 !== 0) cells.push(null)
      out.push({
        label: cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        cells,
      })
      cursor = new Date(year, month + 1, 1)
    }
    return out
  }, [habit])

  const weekStats = useMemo(() => {
    if (!habit) return { done: 0, scheduled: 0, missed: 0 }
    let done = 0
    let scheduled = 0
    let missed = 0
    for (const row of weeks) {
      for (const cell of row) {
        if (cell.state === 'off' || cell.state === 'future') continue
        scheduled++
        if (cell.state === 'done' || cell.state === 'late') done++
        if (cell.state === 'missed') missed++
      }
    }
    return { done, scheduled, missed }
  }, [weeks, habit])

  if (habit === null) {
    return (
      <div className="card">
        <EmptyState
          icon={<Activity size={40} />}
          title="Habit not found"
          subtitle="It may have been deleted."
          action={<button className="btn btn-primary" onClick={() => navigate('/habits')}>Back to habits</button>}
        />
      </div>
    )
  }
  if (habit === undefined) return <div className="empty">Loading…</div>

  return (
    <>
      <PageHeader
        title={habit.name}
        wrapTitle
        subtitle={habit.description ? stripMarkdownForSnippet(habit.description) : 'Habit history and streak'}
        onBack={() => navigate('/habits')}
        actions={
          <>
            <button className="icon-btn" aria-label="Metrics" onClick={() => navigate('/habits/metrics')}>
              <BarChart3 size={18} />
            </button>
            <button className="icon-btn" aria-label="Edit habit" onClick={() => setShowEdit(true)}>
              <Pencil size={18} />
            </button>
            <button className="icon-btn" aria-label="Delete habit" onClick={() => setShowDelete(true)}>
              <Trash2 size={18} color="var(--error)" />
            </button>
          </>
        }
      />

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="hero-row" style={{ marginTop: 0 }}>
          <div>
            <div className="hero-label">Frequency</div>
            <div className="bold small">{habitFrequencyLabel(habit)}</div>
          </div>
          <div>
            <div className="hero-label">Streak</div>
            <div className="bold">{plural(habit.currentStreak, 'day')}</div>
          </div>
          <div>
            <div className="hero-label">Best</div>
            <div className="bold">{plural(habit.bestStreak, 'day')}</div>
          </div>
        </div>
        <div className="tiny muted" style={{ marginTop: 10 }}>
          Created {formatDateKey(toDateKey(habit.createdAt), true)}
          {habit.deadlineHour != null && habit.deadlineMinute != null
            ? ` · Deadline ${String(habit.deadlineHour).padStart(2, '0')}:${String(habit.deadlineMinute).padStart(2, '0')}`
            : ''}
          {habit.isArchived ? ' · Archived' : ''}
        </div>
        <div className="tiny muted" style={{ marginTop: 4 }}>
          {weekStats.done} of {weekStats.scheduled} scheduled days done
          {weekStats.missed > 0 ? ` · ${weekStats.missed} missed` : ''}
        </div>
      </div>

      <Segmented
        value={period}
        onChange={setPeriod}
        label="Calendar period"
        style={{ marginBottom: 12 }}
        options={[
          { value: 'Weekly', label: 'Weekly' },
          { value: 'Monthly', label: 'Monthly' },
        ]}
      />

      <div className="card" style={{ marginBottom: 12 }}>
        {period === 'Weekly' ? (
          <>
            <div className="habit-grid" style={{ marginBottom: 4 }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="habit-day-label">{d.slice(0, 1)}</div>
              ))}
            </div>
            <div className="stack" style={{ gap: 4 }}>
              {weeks.map((row, i) => (
                <div key={i} className="habit-grid">
                  {row.map((cell) => (
                    <DayCell key={cell.key} cell={cell} onSelect={() => setSelected(cell)} />
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="stack" style={{ gap: 18 }}>
            {months.map((m) => (
              <div key={m.label}>
                <div className="bold small" style={{ marginBottom: 6 }}>{m.label}</div>
                <div className="habit-grid" style={{ marginBottom: 4 }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="habit-day-label">{d.slice(0, 1)}</div>
                  ))}
                </div>
                <div className="habit-grid">
                  {m.cells.map((cell, i) =>
                    cell ? <DayCell key={cell.key} cell={cell} onSelect={() => setSelected(cell)} /> : <span key={`x${i}`} />,
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="legend">
          <span><i style={{ background: 'var(--primary)' }} /> Done</span>
          <span><i style={{ background: 'var(--warning)' }} /> Late</span>
          <span><i style={{ background: 'var(--warning)' }} /> Skipped</span>
          <span><i style={{ background: 'var(--error)' }} /> Missed</span>
          <span><i style={{ background: 'var(--surface-2)' }} /> Off / future</span>
        </div>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          Tap any scheduled day to mark it done, late or missed and add a note.
        </p>
      </div>

      {showEdit && <HabitDialog habit={habit} onClose={() => setShowEdit(false)} />}
      {selected && (
        <HabitDayDialog
          habit={habit}
          cell={selected}
          onClose={() => setSelected(null)}
        />
      )}

      <ConfirmDialog
        open={showDelete}
        title="Delete Habit"
        message={`Delete "${habit.name}"? It is hidden from the list but its history is kept.`}
        onCancel={() => setShowDelete(false)}
        onConfirm={async () => {
          await db.habits.update(habit.id!, { isDeleted: true, deletedAt: Date.now() })
          navigate('/habits')
        }}
      />
    </>
  )
}

function DayCell({ cell, onSelect }: { cell: DayStatus; onSelect: () => void }) {
  const label = (() => {
    switch (cell.state) {
      case 'done':
        return '✓'
      case 'late':
        return '✓*'
      case 'skipped':
        return '↷'
      case 'missed':
        return '✗'
      case 'warning':
        return '!'
      case 'off':
        return '-'
      default:
        return cell.date.getDate()
    }
  })()

  return (
    <button
      type="button"
      className={`habit-cell ${cell.state}`}
      disabled={cell.state === 'off' || !cell.scheduled}
      aria-label={`${cell.key} ${cell.state}`}
      title={`${formatDateKey(cell.key, true)} · ${cell.state}`}
      onClick={onSelect}
    >
      {label}
    </button>
  )
}

function HabitDayDialog({ habit, cell, onClose }: { habit: Habit; cell: DayStatus; onClose: () => void }) {
  const [note, setNote] = useState(habit.dailyNotes[cell.key] ?? '')
  const [status, setStatus] = useState(cell.state)
  const [needsReason, setNeedsReason] = useState(false)

  const apply = async (next: 'done' | 'late' | 'missed' | 'pending') => {
    setNeedsReason(false)
    if (next === 'done') await toggleHabitForDate(habit.id!, cell.key, true)
    if (next === 'late') await completeHabitLate(habit.id!, cell.key)
    if (next === 'missed') await setHabitMissed(habit.id!, cell.key)
    if (next === 'pending') await setHabitPending(habit.id!, cell.key)
    setStatus(next)
  }

  const skip = async () => {
    if (!note.trim()) {
      setNeedsReason(true)
      return
    }
    await updateHabitDailyNote(habit.id!, cell.key, note)
    await setHabitSkipped(habit.id!, cell.key)
    setNeedsReason(false)
    setStatus('skipped')
  }

  const save = async () => {
    if ((needsReason || status === 'skipped') && !note.trim()) {
      setNeedsReason(true)
      return
    }
    await updateHabitDailyNote(habit.id!, cell.key, note)
    if (needsReason) {
      await setHabitSkipped(habit.id!, cell.key)
      setStatus('skipped')
      setNeedsReason(false)
    }
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={formatDateKey(cell.key, true)}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => void save()}>
            {needsReason ? 'Save & skip' : 'Save note'}
          </button>
        </div>
      }
    >
      <div className="stack">
        <p className="small muted">{habit.name} · currently {status}</p>
        <div className="chip-row">
          <button className={`chip ${status === 'done' ? 'active' : ''}`} onClick={() => void apply('done')}>Done</button>
          <button className={`chip ${status === 'late' ? 'active' : ''}`} onClick={() => void apply('late')}>Done late</button>
          <button className={`chip ${status === 'missed' ? 'active' : ''}`} onClick={() => void apply('missed')}>Missed</button>
          <button className={`chip ${status === 'skipped' ? 'active' : ''}`} onClick={() => void skip()}>Skip</button>
          <button className={`chip ${status === 'pending' ? 'active' : ''}`} onClick={() => void apply('pending')}>Clear</button>
        </div>
        {needsReason && (
          <p className="tiny" style={{ color: 'var(--warning)', margin: 0 }}>
            Add a reason below to skip this habit.
          </p>
        )}
        <TextArea
          value={note}
          onValueChange={setNote}
          placeholder={needsReason ? 'Why are you skipping this habit?' : 'Notes for this day'}
          preview="below"
        />
      </div>
    </Dialog>
  )
}
