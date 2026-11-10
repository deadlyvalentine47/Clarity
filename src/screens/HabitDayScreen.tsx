import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import { db } from '../db/db'
import type { Habit, HabitGroup } from '../db/types'
import {
  completeHabitLate,
  habitFrequencyLabel,
  isScheduledOn,
  setHabitMissed,
  setHabitPending,
  setHabitSkipped,
  toggleHabitForDate,
  updateHabitDailyNote,
} from '../db/habits'
import { buildTopLevelRows, setHabitGroupCollapsed } from '../db/habitGroups'
import { formatDateKey, fromDateKey, toDateKey } from '../lib/dates'
import { EmptyState, PageHeader } from '../components/ui'
import { RichTextEditor } from '../components/RichTextEditor'
import { useSavedFlash } from '../hooks/useSavedFlash'

type Status = 'done' | 'late' | 'missed' | 'skipped' | 'warning' | 'pending' | 'off'

function statusOf(habit: Habit, key: string): Status {
  if (habit.completionHistory[key] === true) return habit.lateCompletions.includes(key) ? 'late' : 'done'
  if (habit.skippedDates?.[key]) return 'skipped'
  if (habit.completionHistory[key] === false) return 'missed'
  if (habit.isArchived || habit.isDeleted) return 'warning'
  return 'pending'
}

const STATUS_LABEL: Record<Status, string> = {
  done: 'done',
  late: 'done late',
  missed: 'missed',
  skipped: 'skipped',
  warning: 'unfinished',
  pending: 'pending',
  off: 'n/a',
}

export default function HabitDayScreen() {
  const { date } = useParams()
  const navigate = useNavigate()
  const key = date ?? toDateKey(new Date())
  const day = fromDateKey(key)

  const habits = useLiveQuery(async () => db.habits.toArray(), [], [])
  const groups = useLiveQuery(async () => db.habitGroups.toArray(), [], [])
  const journal = useLiveQuery(async () => (await db.dayJournals.get(key)) ?? null, [key])
  const [journalText, setJournalText] = useState('')
  const [journalOpen, setJournalOpen] = useState(true)
  const [journalSaved, flashJournalSaved] = useSavedFlash()
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const seededKey = useRef<string | null>(null)

  useEffect(() => {
    if (journal?.content) setJournalText(journal.content)
  }, [journal])

  // Rows with a saved note for this day start expanded. The live query starts
  // as an empty array, so wait for the first real load before seeding.
  useEffect(() => {
    if (habits.length === 0 || seededKey.current === key) return
    seededKey.current = key
    const withNotes = habits
      .filter((h) => (h.dailyNotes[key] ?? '').trim() !== '')
      .map((h) => h.id!)
    setExpanded(new Set(withNotes))
  }, [habits, key])

  const rows = useMemo(
    () => (habits ?? []).filter((h) => isScheduledOn(h, day)),
    [habits, day],
  )
  const active = rows.filter((h) => !h.isArchived && !h.isDeleted)
  const archived = rows.filter((h) => h.isArchived || h.isDeleted)
  const activeRows = useMemo(() => {
    const relevant = (groups ?? []).filter((g) => active.some((h) => h.groupId === g.id))
    return buildTopLevelRows(active, relevant)
  }, [groups, active])
  const done = rows.filter((h) => statusOf(h, key) === 'done' || statusOf(h, key) === 'late').length
  const scheduled = rows.filter((h) => statusOf(h, key) !== 'skipped').length
  const rate = scheduled === 0 ? 0 : done / scheduled

  const toggleRow = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const dayRow = (habit: Habit) => (
    <HabitDayRow
      key={habit.id}
      habit={habit}
      dateKey={key}
      expanded={expanded.has(habit.id!)}
      onToggle={() => toggleRow(habit.id!)}
    />
  )

  const groupDay = (group: HabitGroup, list: Habit[]) => {
    const collapsed = group.isCollapsed !== false
    const doneCount = list.filter(
      (h) => statusOf(h, key) === 'done' || statusOf(h, key) === 'late',
    ).length
    const scheduledCount = list.filter((h) => statusOf(h, key) !== 'skipped').length
    return (
      <div key={`group-${group.id}`} className="stack" style={{ gap: 8 }}>
        <button
          className="habit-group-toggle"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
          onClick={() => void setHabitGroupCollapsed(group.id!, !collapsed)}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${group.name}`}
        >
          <span className="habit-group-name bold small">
            <span className="habit-group-chevron">
              {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            </span>
            <span className="wrap-anywhere">{group.name}</span>
          </span>
          <span className="tiny muted nowrap">{doneCount}/{scheduledCount} done</span>
        </button>
        {!collapsed && (
          <div className="metric-group-items">{list.map((habit) => dayRow(habit))}</div>
        )}
      </div>
    )
  }

  const saveJournal = async () => {
    await db.dayJournals.put({ date: key, content: journalText.trim(), updatedAt: Date.now() })
    flashJournalSaved()
  }

  return (
    <>
      <PageHeader
        title={formatDateKey(key, true)}
        subtitle={`${done} of ${scheduled} habits done (${Math.round(rate * 100)}%)`}
        onBack={() => navigate('/habits/metrics')}
      />

      <div className="card" style={{ marginBottom: 12 }}>
        <button
          className="row-between"
          style={{ background: 'none', border: 'none', width: '100%', padding: 0, cursor: 'pointer', color: 'inherit' }}
          onClick={() => setJournalOpen((v) => !v)}
          aria-expanded={journalOpen}
        >
          <span className="bold">Journal</span>
          {journalOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {journalOpen && (
          <div style={{ marginTop: 10 }}>
            <RichTextEditor
              value={journalText}
              onValueChange={setJournalText}
              placeholder="How was your day?"
              size="lg"
              ariaLabel="Journal"
            />
            <div className="row-between" style={{ marginTop: 8 }}>
              <span className="tiny muted">{journalSaved ? 'Saved' : journal ? `Updated ${new Date(journal.updatedAt).toLocaleTimeString()}` : 'Not saved yet'}</span>
              <button className="btn btn-primary btn-sm" onClick={() => void saveJournal()}>Save</button>
            </div>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Activity size={40} />} title="No habits scheduled" subtitle="Nothing was scheduled for this day." />
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <div className="section-label" style={{ marginBottom: 8 }}>Habits</div>
              <div className="stack" style={{ gap: 10, marginBottom: 16 }}>
                {activeRows.map((row) =>
                  row.kind === 'group' ? groupDay(row.group, row.habits) : dayRow(row.habit),
                )}
              </div>
            </>
          )}

          {archived.length > 0 && (
            <>
              <div className="section-label" style={{ marginBottom: 8 }}>Archived / deleted</div>
              <div className="stack" style={{ gap: 8 }}>
                {archived.map((habit) => (
                  <HabitDayRow
                    key={habit.id}
                    habit={habit}
                    dateKey={key}
                    expanded={expanded.has(habit.id!)}
                    onToggle={() => toggleRow(habit.id!)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}

function HabitDayRow({
  habit,
  dateKey,
  expanded,
  onToggle,
}: {
  habit: Habit
  dateKey: string
  expanded: boolean
  onToggle: () => void
}) {
  const [note, setNote] = useState(habit.dailyNotes[dateKey] ?? '')
  const [status, setStatus] = useState<Status>(statusOf(habit, dateKey))
  const [saved, flashSaved] = useSavedFlash()
  const [needsReason, setNeedsReason] = useState(false)

  const focusNote = () => document.getElementById(`habit-note-${habit.id}`)?.focus()

  const apply = async (next: Status) => {
    setNeedsReason(false)
    if (next === 'done') await toggleHabitForDate(habit.id!, dateKey, true)
    else if (next === 'late') await completeHabitLate(habit.id!, dateKey)
    else if (next === 'missed') await setHabitMissed(habit.id!, dateKey)
    else if (next === 'pending') await setHabitPending(habit.id!, dateKey)
    setStatus(next)
  }

  const skip = async () => {
    if (!note.trim()) {
      setNeedsReason(true)
      focusNote()
      return
    }
    await updateHabitDailyNote(habit.id!, dateKey, note)
    await setHabitSkipped(habit.id!, dateKey)
    setNeedsReason(false)
    setStatus('skipped')
  }

  const saveNote = async () => {
    if ((needsReason || status === 'skipped') && !note.trim()) {
      setNeedsReason(true)
      focusNote()
      return
    }
    await updateHabitDailyNote(habit.id!, dateKey, note)
    if (needsReason) {
      await setHabitSkipped(habit.id!, dateKey)
      setStatus('skipped')
      setNeedsReason(false)
    }
    flashSaved()
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row">
        <span className={`status-dot ${status}`}>
          {status === 'done' ? '✓' : status === 'late' ? '✓' : status === 'missed' ? '✗' : status === 'skipped' ? '↷' : status === 'warning' ? '!' : '·'}
        </span>
        <button
          className="grow"
          style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer', color: 'inherit', minWidth: 0 }}
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <div className="small bold wrap-anywhere">
            {habit.name}
            {habit.isArchived ? ' (A)' : ''}
            {habit.isDeleted ? ' (D)' : ''}
          </div>
          <div className="tiny muted">{habitFrequencyLabel(habit)}</div>
        </button>
        <span className="tiny muted nowrap">{STATUS_LABEL[status]}</span>
        <button className="icon-btn" aria-label={expanded ? 'Collapse' : 'Expand'} onClick={onToggle}>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          <hr className="hr" />
          <div className="chip-row" style={{ marginBottom: 8 }}>
            <button className={`chip ${status === 'done' ? 'active' : ''}`} onClick={() => void apply('done')}>Done</button>
            <button className={`chip ${status === 'late' ? 'active' : ''}`} onClick={() => void apply('late')}>Done late</button>
            <button className={`chip ${status === 'missed' ? 'active' : ''}`} onClick={() => void apply('missed')}>Missed</button>
            <button className={`chip ${status === 'skipped' ? 'active' : ''}`} onClick={() => void skip()}>Skip</button>
            <button className={`chip ${status === 'pending' ? 'active' : ''}`} onClick={() => void apply('pending')}>Clear</button>
          </div>
          <RichTextEditor
            id={`habit-note-${habit.id}`}
            value={note}
            onValueChange={setNote}
            placeholder={needsReason ? 'Why are you skipping this habit?' : 'Notes for this day'}
            ariaLabel={`Notes for ${habit.name}`}
          />
          <div className="row-between" style={{ marginTop: 6 }}>
            <span className="tiny muted" style={{ color: needsReason ? 'var(--warning)' : undefined }}>
              {needsReason ? 'Add a reason to skip' : saved ? 'Saved' : ''}
            </span>
            <button className="btn btn-sm btn-primary" onClick={() => void saveNote()}>
              {needsReason ? 'Save & skip' : 'Save note'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
