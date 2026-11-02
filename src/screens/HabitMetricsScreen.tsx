import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Activity, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import { db } from '../db/db'
import type { Habit, HabitGroup } from '../db/types'
import { habitCreatedDate, habitEndDate, habitFrequencyLabel, isScheduledOn } from '../db/habits'
import { buildTopLevelRows, setHabitGroupCollapsed } from '../db/habitGroups'
import { formatDateKey, toDateKey } from '../lib/dates'
import { EmptyState, PageHeader } from '../components/ui'
import { MonthYearPicker } from './budget/shared'

interface Stats {
  habit: Habit
  scheduled: number
  completed: number
  missed: number
}

function monthStats(habit: Habit, year: number, month: number): Stats {
  const created = habitCreatedDate(habit)
  const end = habitEndDate(habit)
  const start = new Date(year, month - 1, 1, 12)
  const monthEnd = new Date(year, month, 0, 12)
  const todayDate = new Date()
  const today = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 12)
  const cursorStart = created > start ? created : start
  const cursorEnd = monthEnd < (end ?? today) ? monthEnd : (end ?? today)
  let scheduled = 0
  let completed = 0
  let missed = 0
  let cursor = new Date(cursorStart)
  let guard = 0
  while (cursor <= cursorEnd && guard < 40) {
    guard++
    if (isScheduledOn(habit, cursor)) {
      scheduled++
      const key = toDateKey(cursor)
      if (habit.completionHistory[key] === true) completed++
      else if (habit.completionHistory[key] === false) missed++
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 12)
  }
  return { habit, scheduled, completed, missed }
}

function aliveInMonth(habit: Habit, year: number, month: number): boolean {
  const created = habitCreatedDate(habit)
  const end = habitEndDate(habit)
  const first = new Date(year, month - 1, 1, 12)
  const last = new Date(year, month, 0, 12)
  if (created > last) return false
  if (end && end < first) return false
  return true
}

export default function HabitMetricsScreen() {
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [tab, setTab] = useState<'Month' | 'Habits'>('Month')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const habits = useLiveQuery(async () => db.habits.toArray(), [], [])
  const groups = useLiveQuery(async () => db.habitGroups.toArray(), [], [])

  const monthHabits = useMemo(
    () => (habits ?? []).filter((h) => aliveInMonth(h, year, month)),
    [habits, year, month],
  )
  const stats = useMemo(() => monthHabits.map((h) => monthStats(h, year, month)), [monthHabits, year, month])
  const statsById = useMemo(() => {
    const map = new Map<number, Stats>()
    for (const s of stats) if (s.habit.id != null) map.set(s.habit.id, s)
    return map
  }, [stats])
  const rows = useMemo(() => {
    const relevant = (groups ?? []).filter((g) => monthHabits.some((h) => h.groupId === g.id))
    return buildTopLevelRows(monthHabits, relevant)
  }, [groups, monthHabits])
  const totalScheduled = stats.reduce((s, x) => s + x.scheduled, 0)
  const totalCompleted = stats.reduce((s, x) => s + x.completed, 0)
  const totalMissed = stats.reduce((s, x) => s + x.missed, 0)
  const rate = totalScheduled === 0 ? 0 : totalCompleted / totalScheduled
  const activeCount = monthHabits.filter((h) => !h.isArchived && !h.isDeleted).length
  const archivedCount = monthHabits.filter((h) => h.isArchived).length
  const deletedCount = monthHabits.filter((h) => h.isDeleted).length

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1, 12)
    const days = new Date(year, month, 0).getDate()
    const offset = first.getDay()
    const out: ({ day: number; date: Date; scheduled: number; done: number; missed: number; late: number; warning: number } | null)[] = []
    for (let i = 0; i < offset; i++) out.push(null)
    for (let d = 1; d <= days; d++) {
      const date = new Date(year, month - 1, d, 12)
      let scheduled = 0
      let done = 0
      let missed = 0
      let late = 0
      let warning = 0
      for (const habit of monthHabits) {
        if (!isScheduledOn(habit, date)) continue
        scheduled++
        const key = toDateKey(date)
        if (habit.completionHistory[key] === true) {
          done++
          if (habit.lateCompletions.includes(key)) late++
        } else if (habit.completionHistory[key] === false) {
          missed++
        } else if (habit.isArchived || habit.isDeleted) {
          warning++
        }
      }
      out.push({ day: d, date, scheduled, done, missed, late, warning })
    }
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [year, month, monthHabits])

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const groupTotals = (list: Habit[]) => {
    let scheduled = 0
    let completed = 0
    for (const habit of list) {
      const s = habit.id != null ? statsById.get(habit.id) : undefined
      if (!s) continue
      scheduled += s.scheduled
      completed += s.completed
    }
    return { scheduled, completed, pct: scheduled === 0 ? 0 : completed / scheduled }
  }

  const summaryCard = (habit: Habit) => {
    const s = habit.id != null ? statsById.get(habit.id) : undefined
    if (!s) return null
    const pct = s.scheduled === 0 ? 0 : s.completed / s.scheduled
    return (
      <div key={habit.id} className="card" style={{ padding: 14 }}>
        <div className="row-between">
          <div style={{ minWidth: 0 }}>
            <div className="bold truncate">
              {habit.name}
              {habit.isArchived ? ' (A)' : ''}
              {habit.isDeleted ? ' (D)' : ''}
            </div>
            <div className="tiny muted">{habitFrequencyLabel(habit)} · Streak {habit.currentStreak}</div>
            {habit.isArchived && habit.archivedAt != null && (
              <div className="tiny muted">Archived {formatDateKey(toDateKey(habit.archivedAt), true)}</div>
            )}
            {habit.isDeleted && habit.deletedAt != null && (
              <div className="tiny" style={{ color: 'var(--error)' }}>Deleted {formatDateKey(toDateKey(habit.deletedAt), true)}</div>
            )}
          </div>
          <div className="align-end">
            <div className="bold">{s.completed}/{s.scheduled}</div>
            <div className="tiny" style={{ color: pct >= 0.6 ? 'var(--success)' : 'var(--error)' }}>
              {Math.round(pct * 100)}%
            </div>
          </div>
        </div>
      </div>
    )
  }

  const habitRow = (habit: Habit) => {
    const s = habit.id != null ? statsById.get(habit.id) : undefined
    if (!s) return null
    const isOpen = expanded.has(habit.id!)
    return (
      <div key={habit.id} className="card">
        <button
          className="row-between"
          style={{ background: 'none', border: 'none', width: '100%', padding: 0, cursor: 'pointer', color: 'inherit' }}
          onClick={() => setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(habit.id!)) next.delete(habit.id!)
            else next.add(habit.id!)
            return next
          })}
          aria-expanded={isOpen}
        >
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <div className="bold truncate">
              {habit.name}
              {habit.isArchived ? ' (A)' : ''}
              {habit.isDeleted ? ' (D)' : ''}
            </div>
            <div className="tiny muted">
              {habitFrequencyLabel(habit)} · Streak {habit.currentStreak} · Best {habit.bestStreak}
            </div>
          </div>
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        <div className="small" style={{ marginTop: 8 }}>
          Completed {s.completed}/{s.scheduled} ({Math.round((s.scheduled === 0 ? 0 : s.completed / s.scheduled) * 100)}%)
        </div>
        {isOpen && <HabitMonthGrid habit={habit} year={year} month={month} />}
      </div>
    )
  }

  const isCollapsed = (group: HabitGroup) => group.isCollapsed !== false

  const groupHead = (group: HabitGroup, list: Habit[]) => {
    const totals = groupTotals(list)
    const collapsed = isCollapsed(group)
    return (
      <button
        className="metric-group-head"
        style={{ width: '100%', padding: 0, border: 'none', background: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
        onClick={() => void setHabitGroupCollapsed(group.id!, !collapsed)}
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${group.name}`}
      >
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
          <span className="habit-group-chevron" style={{ marginTop: 2 }}>
            {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="bold truncate">{group.name}</div>
            <div className="tiny muted">{list.length} {list.length === 1 ? 'habit' : 'habits'}</div>
          </div>
        </div>
        <div className="align-end">
          <div className="bold">{totals.completed}/{totals.scheduled}</div>
          <div className="tiny" style={{ color: totals.pct >= 0.6 ? 'var(--success)' : 'var(--error)' }}>
            {Math.round(totals.pct * 100)}%
          </div>
        </div>
      </button>
    )
  }

  return (
    <>
      <PageHeader
        title="Habit Metrics"
        subtitle={monthLabel}
        onBack={() => navigate('/habits')}
        actions={<MonthYearPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />}
      />

      <div className="tab-row">
        <button className={tab === 'Month' ? 'active' : ''} onClick={() => setTab('Month')}>Month</button>
        <button className={tab === 'Habits' ? 'active' : ''} onClick={() => setTab('Habits')}>Habits</button>
      </div>

      {monthHabits.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Activity size={40} />} title="No habits yet" subtitle="Add a habit to see monthly metrics." />
        </div>
      ) : tab === 'Month' ? (
        <>
          <div className="grid-3" style={{ marginBottom: 12 }}>
            <div className="card primary" style={{ padding: 12 }}>
              <div className="tiny">Habits</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{activeCount}</div>
              <div className="tiny" style={{ opacity: 0.8 }}>
                {archivedCount + deletedCount > 0
                  ? [archivedCount ? `${archivedCount} archived` : '', deletedCount ? `${deletedCount} deleted` : ''].filter(Boolean).join(', ')
                  : 'all active'}
              </div>
            </div>
            <div className="card primary" style={{ padding: 12 }}>
              <div className="tiny">Completed</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{totalCompleted}</div>
              <div className="tiny" style={{ opacity: 0.8 }}>of {totalScheduled}</div>
            </div>
            <div className="card primary" style={{ padding: 12 }}>
              <div className="tiny">Rate</div>
              <div className="stat-value" style={{ fontSize: 22, color: rate >= 0.6 ? 'var(--success)' : 'var(--error)' }}>
                {Math.round(rate * 100)}%
              </div>
              <div className="tiny" style={{ opacity: 0.8 }}>{totalMissed} missed</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="bold small" style={{ marginBottom: 8 }}>Tap a day for details</div>
            <div className="habit-grid" style={{ marginBottom: 4 }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="habit-day-label">{d.slice(0, 1)}</div>
              ))}
            </div>
            <div className="habit-grid">
              {cells.map((cell, i) => {
                if (!cell) return <span key={`x${i}`} />
                const state =
                  cell.missed > 0
                    ? 'missed'
                    : cell.late > 0 || cell.warning > 0
                      ? 'late'
                      : cell.scheduled > 0 && cell.done === cell.scheduled
                        ? 'done'
                        : cell.scheduled > 0
                          ? cell.done > 0
                            ? 'partial'
                            : 'pending'
                          : 'off'
                const label =
                  cell.missed > 0
                    ? `✗${cell.missed}`
                    : cell.late > 0 || cell.warning > 0
                      ? '!'
                      : cell.scheduled > 0 && cell.done === cell.scheduled
                        ? '✓'
                        : cell.done > 0
                          ? `${cell.done}/${cell.scheduled}`
                          : String(cell.day)
                return (
                  <button
                    key={toDateKey(cell.date)}
                    className={`habit-cell ${state}`}
                    onClick={() => navigate(`/habits/metrics/${toDateKey(cell.date)}`)}
                    title={`${formatDateKey(toDateKey(cell.date), true)} · ${cell.done}/${cell.scheduled} done`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <div className="legend">
              <span><i style={{ background: 'var(--primary)' }} /> all done</span>
              <span><i style={{ background: 'var(--primary-container)' }} /> some done</span>
              <span><i style={{ background: 'var(--warning)' }} /> late / warning</span>
              <span><i style={{ background: 'var(--error)' }} /> some missed</span>
              <span><i style={{ background: 'var(--surface-2)' }} /> none</span>
            </div>
          </div>

          <div className="section-label" style={{ marginBottom: 8 }}>Monthly summary</div>
          <div className="stack" style={{ gap: 8 }}>
            {rows.map((row) =>
              row.kind === 'group' ? (
                <div key={`group-${row.group.id}`} className="card" style={{ padding: 14 }}>
                  {groupHead(row.group, row.habits)}
                  {!isCollapsed(row.group) && (
                    <div className="metric-group-items">
                      {row.habits.map((habit) => summaryCard(habit))}
                    </div>
                  )}
                </div>
              ) : (
                summaryCard(row.habit)
              ),
            )}
          </div>
        </>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {rows.map((row) =>
            row.kind === 'group' ? (
              <div key={`group-${row.group.id}`} className="stack" style={{ gap: 8 }}>
                <div className="card" style={{ padding: 12 }}>{groupHead(row.group, row.habits)}</div>
                {!isCollapsed(row.group) && (
                  <div className="metric-group-items">{row.habits.map((habit) => habitRow(habit))}</div>
                )}
              </div>
            ) : (
              habitRow(row.habit)
            ),
          )}
        </div>
      )}
    </>
  )
}

function HabitMonthGrid({ habit, year, month }: { habit: Habit; year: number; month: number }) {
  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1, 12)
    const days = new Date(year, month, 0).getDate()
    const offset = first.getDay()
    const out: ({ date: Date; state: string; label: string } | null)[] = []
    for (let i = 0; i < offset; i++) out.push(null)
    for (let d = 1; d <= days; d++) {
      const date = new Date(year, month - 1, d, 12)
      const key = toDateKey(date)
      const scheduled = isScheduledOn(habit, date)
      const done = habit.completionHistory[key] === true
      const late = habit.lateCompletions.includes(key)
      const missed = habit.completionHistory[key] === false
      let state = 'off'
      let label = String(d)
      if (!scheduled) {
        state = 'off'
        label = '-'
      } else if (done) {
        state = late ? 'late' : 'done'
        label = late ? '✓*' : '✓'
      } else if (missed) {
        state = 'missed'
        label = '✗'
      } else if (habit.isArchived || habit.isDeleted) {
        state = 'warning'
        label = '!'
      }
      out.push({ date, state, label })
    }
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [habit, year, month])

  return (
    <div style={{ marginTop: 10 }}>
      <div className="habit-grid" style={{ marginBottom: 4 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="habit-day-label">{d.slice(0, 1)}</div>
        ))}
      </div>
      <div className="habit-grid">
        {cells.map((cell, i) =>
          cell ? (
            <span key={toDateKey(cell.date)} className={`habit-cell ${cell.state}`} title={formatDateKey(toDateKey(cell.date), true)}>
              {cell.label}
            </span>
          ) : (
            <span key={`x${i}`} />
          ),
        )}
      </div>
    </div>
  )
}
