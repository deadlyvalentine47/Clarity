import { useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  Flag,
  ListTodo,
  Plus,
  Settings,
  StickyNote,
  Timer,
  Wallet,
} from 'lucide-react'
import { db } from '../db/db'
import type { Event as ClarityEvent, Habit, HomeSection, Task } from '../db/types'
import { usePreferences } from '../context/PreferencesContext'
import { isScheduledOn, toggleHabitForDate } from '../db/habits'
import { toggleTaskCompletion } from '../db/tasks'
import { noteSnippet } from '../db/notes'
import { cardOutstanding, cardPurchasesInCycle, isSelfTransfer, spendSummary, totalBankBalance } from '../db/budget'
import {
  addDays,
  endOfDay,
  formatShortDate,
  fromDateKey,
  greetingFor,
  monthRange,
  startOfDay,
  toDateKey,
} from '../lib/dates'
import { formatDuration, formatMoney, plural } from '../lib/format'
import { CollapsibleHeader, ProgressBar, ProgressRing, priorityClass } from '../components/ui'
import { TaskDialog } from './TasksScreen'
import { TransactionDialog } from './budget/shared'

const COLLAPSE_KEY = 'clarity.home.collapsed'

/** Section collapse state survives navigation and reloads. */
function useCollapsedSections() {
  const [collapsed, setCollapsed] = useState<Set<HomeSection>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY)
      const parsed = raw ? (JSON.parse(raw) as HomeSection[]) : []
      return new Set(Array.isArray(parsed) ? parsed : [])
    } catch {
      return new Set()
    }
  })

  const toggle = (section: HomeSection) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]))
      } catch {
        // Private mode / quota — collapsing is a nicety, not a requirement.
      }
      return next
    })

  return [collapsed, toggle] as const
}

export default function HomeScreen() {
  const { prefs } = usePreferences()
  const navigate = useNavigate()
  const [collapsed, toggleSection] = useCollapsedSections()
  const [showAddTask, setShowAddTask] = useState(false)
  const [showAddSpend, setShowAddSpend] = useState(false)

  const now = new Date()
  const todayKey = toDateKey(now)
  const dayStart = startOfDay(now.getTime())
  const dayEnd = endOfDay(now.getTime())
  const [monthStart, monthEnd] = monthRange(now.getFullYear(), now.getMonth() + 1)

  const tasks = useLiveQuery(async () => db.tasks.toArray(), [], [])
  const habits = useLiveQuery(async () => db.habits.toArray(), [], [])
  const events = useLiveQuery(async () => db.events.toArray(), [], [])
  const transactions = useLiveQuery(async () => db.transactions.toArray(), [], [])
  const cardTxns = useLiveQuery(async () => db.creditCardTransactions.toArray(), [], [])
  const sources = useLiveQuery(async () => db.sources.toArray(), [], [])
  const cards = useLiveQuery(async () => db.creditCards.toArray(), [], [])
  const notes = useLiveQuery(async () => db.notes.toArray(), [], [])
  const goals = useLiveQuery(async () => db.goals.toArray(), [], [])
  const focusSessions = useLiveQuery(
    async () => db.pomodoroSessions.where('type').equals('Focus').toArray(),
    [],
    [],
  )

  // ---------------------------------------------------------------- tasks
  const pending = (tasks ?? []).filter((t) => !t.isCompleted)
  const dueToday = (tasks ?? []).filter((t) => t.dueDate != null && toDateKey(t.dueDate) === todayKey)
  const todayOpen = pending.filter((t) => t.dueDate != null && toDateKey(t.dueDate) === todayKey)
  const overdue = pending
    .filter((t) => t.dueDate != null && toDateKey(t.dueDate) < todayKey)
    .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))
  const unscheduled = pending.filter((t) => t.dueDate == null)
  const upcoming = pending
    .filter((t) => t.dueDate != null && toDateKey(t.dueDate) > todayKey)
    .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))

  // --------------------------------------------------------------- habits
  const activeHabits = (habits ?? []).filter((h) => !h.isArchived && !h.isDeleted)
  const habitsToday = activeHabits.filter((h) => isScheduledOn(h, now))
  const habitsDone = habitsToday.filter((h) => h.completionHistory[todayKey] === true).length

  // --------------------------------------------------------------- events
  const upcomingEvents = (events ?? [])
    .filter((e) => e.endDate >= now.getTime())
    .sort((a, b) => a.startDate - b.startDate)
  const todayEvents = (events ?? []).filter(
    (e) => e.startDate <= dayEnd && e.endDate >= Math.max(dayStart, now.getTime()),
  )

  // --------------------------------------------------------------- money
  // Bank spending is calendar-month; card spending follows each card's billing
  // cycle that ends in the current month, like the card detail screen.
  const bankSpend = spendSummary(transactions ?? [], [], monthStart, monthEnd).bank
  const cardSpend = (cards ?? []).reduce(
    (sum, card) =>
      sum + cardPurchasesInCycle(card, cardTxns ?? [], now.getFullYear(), now.getMonth() + 1),
    0,
  )
  const spend = { bank: bankSpend, card: cardSpend, total: bankSpend + cardSpend }
  const income = (transactions ?? [])
    .filter((t) => t.type === 'Income' && !isSelfTransfer(t) && t.date >= monthStart && t.date <= monthEnd)
    .reduce((sum, t) => sum + t.amount, 0)
  const bankBalance = totalBankBalance(sources ?? [])
  const cardDebt = (cards ?? []).reduce(
    (sum, card) =>
      sum + Math.max(0, cardOutstanding((cardTxns ?? []).filter((t) => t.cardId === card.id))),
    0,
  )

  // ------------------------------------------------------------- pomodoro
  const focusToday = (focusSessions ?? []).filter(
    (s) => s.completedAt >= dayStart && s.completedAt <= dayEnd,
  )
  const focusMinutes = focusToday.reduce((sum, s) => sum + s.duration, 0)

  const activeGoals = (goals ?? []).filter((g) => !g.isCompleted)
  const recentNotes = [...(notes ?? [])].sort((a, b) => b.updatedAt - a.updatedAt)

  // ---------------------------------------------------------------- today
  const doneToday = dueToday.filter((t) => t.isCompleted).length + habitsDone
  const totalToday = dueToday.length + habitsToday.length
  const progress = totalToday === 0 ? 0 : doneToday / totalToday

  const todoLeft = todayOpen.length + (habitsToday.length - habitsDone)
  const statusLine = (() => {
    const parts: string[] = []
    if (overdue.length > 0) parts.push(`${overdue.length} overdue`)
    if (todoLeft > 0) parts.push(`${todoLeft} to do today`)
    if (parts.length === 0) {
      if (todayEvents.length > 0) parts.push(`${plural(todayEvents.length, 'event')} today`)
      else if (totalToday > 0) parts.push('All done for today. Nice.')
      else parts.push('Nothing scheduled today — enjoy the quiet.')
    }
    return parts.join(' · ')
  })()

  const greeting = greetingFor(now.getHours())
  const firstName = prefs.username.trim().split(/\s+/)[0] || 'there'

  const sections = useMemo(
    () => prefs.sectionOrder.filter((s) => prefs.sectionEnabled.includes(s)),
    [prefs.sectionOrder, prefs.sectionEnabled],
  )

  const completeTask = async (task: Task) => {
    if (task.id == null) return
    await toggleTaskCompletion(task.id, true)
  }

  const toggleHabit = async (habit: Habit) => {
    if (habit.id == null) return
    const done = habit.completionHistory[todayKey] === true
    await toggleHabitForDate(habit.id, todayKey, !done)
  }

  const renderSection = (section: HomeSection) => {
    const open = !collapsed.has(section)
    const onToggle = () => toggleSection(section)

    if (section === 'Tasks') {
      const meta =
        pending.length === 0
          ? 'all clear'
          : [overdue.length > 0 ? `${overdue.length} overdue` : null, `${pending.length} open`]
              .filter(Boolean)
              .join(' · ')
      return (
        <SectionCard
          key={section}
          icon={<ListTodo size={16} />}
          title="Tasks"
          meta={meta}
          open={open}
          onToggle={onToggle}
          action={<OpenLink onClick={() => navigate('/tasks')} />}
        >
          {pending.length === 0 ? (
            <EmptyLine
              icon={<Check size={16} />}
              text="No open tasks"
              action={
                <button className="btn btn-sm btn-outline" onClick={() => setShowAddTask(true)}>
                  <Plus size={14} /> Add
                </button>
              }
            />
          ) : (
            <div className="home-groups">
              <TaskGroup
                label="Overdue"
                tone="error"
                tasks={overdue}
                limit={3}
                onComplete={completeTask}
                hint={(t) => formatShortDate(t.dueDate!)}
                more={() => navigate('/tasks')}
              />
              <TaskGroup
                label="Today"
                tone="primary"
                tasks={todayOpen}
                limit={5}
                onComplete={completeTask}
                more={() => navigate('/tasks')}
              />
              <TaskGroup
                label="No date"
                tone="muted"
                tasks={unscheduled}
                limit={3}
                onComplete={completeTask}
                hint={() => 'Unscheduled'}
                more={() => navigate('/tasks')}
              />
              <TaskGroup
                label="Upcoming"
                tone="muted"
                tasks={upcoming}
                limit={3}
                onComplete={completeTask}
                hint={(t) => formatShortDate(t.dueDate!)}
                more={() => navigate('/tasks')}
              />
            </div>
          )}
        </SectionCard>
      )
    }

    if (section === 'Events') {
      return (
        <SectionCard
          key={section}
          icon={<CalendarDays size={16} />}
          title="Up next"
          meta={todayEvents.length > 0 ? `${todayEvents.length} today` : undefined}
          open={open}
          onToggle={onToggle}
          action={<OpenLink onClick={() => navigate('/calendar')} />}
        >
          {upcomingEvents.length === 0 ? (
            <EmptyLine
              icon={<CalendarDays size={16} />}
              text="No upcoming events"
              action={
                <button className="btn btn-sm btn-outline" onClick={() => navigate('/calendar')}>
                  Add
                </button>
              }
            />
          ) : (
            <div className="agenda">
              {upcomingEvents.slice(0, 3).map((event) => (
                <button
                  key={event.id}
                  className="agenda-row"
                  onClick={() => navigate('/calendar')}
                >
                  <span className="agenda-time">
                    {event.isAllDay
                      ? 'All day'
                      : new Date(event.startDate).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                  </span>
                  <span className="agenda-rail" style={{ background: event.color || 'var(--primary)' }} />
                  <span className="agenda-body">
                    <span className="agenda-title truncate">{event.title}</span>
                    <span className="tiny muted truncate">
                      {dayLabel(event, todayKey)}
                      {event.description ? ` · ${event.description}` : ''}
                    </span>
                  </span>
                  <ChevronRight size={16} className="muted" />
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      )
    }

    if (section === 'Habits') {
      return (
        <SectionCard
          key={section}
          icon={<Activity size={16} />}
          title="Habits"
          meta={habitsToday.length > 0 ? `${habitsDone}/${habitsToday.length} done` : 'none today'}
          open={open}
          onToggle={onToggle}
          action={<OpenLink onClick={() => navigate('/habits')} />}
        >
          {habitsToday.length === 0 ? (
            <EmptyLine
              icon={<Activity size={16} />}
              text="Nothing scheduled for today"
              action={
                <button className="btn btn-sm btn-outline" onClick={() => navigate('/habits')}>
                  Manage
                </button>
              }
            />
          ) : (
            <div className="habit-strip">
              {habitsToday.map((habit) => {
                const done = habit.completionHistory[todayKey] === true
                return (
                  <button
                    key={habit.id}
                    className={`habit-chip ${done ? 'done' : ''}`}
                    aria-pressed={done}
                    aria-label={`${done ? 'Uncheck' : 'Check'} ${habit.name}`}
                    onClick={() => void toggleHabit(habit)}
                  >
                    <span className="habit-chip-check">
                      {done ? <Check size={14} /> : <Circle size={14} />}
                    </span>
                    <span className="habit-chip-name truncate">{habit.name}</span>
                    <span className="habit-chip-streak" title="Current streak">
                      🔥 {habit.currentStreak}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </SectionCard>
      )
    }

    if (section === 'Budget') {
      const burn = income > 0 ? spend.total / income : 0
      return (
        <SectionCard
          key={section}
          icon={<Wallet size={16} />}
          title="Budget"
          meta="this month"
          open={open}
          onToggle={onToggle}
          action={<OpenLink onClick={() => navigate('/budget')} />}
        >
          <div className="money-grid">
            <div className="money-cell">
              <span className="tiny muted">Balance</span>
              <span className="money-value">{formatMoney(bankBalance)}</span>
            </div>
            <div className="money-cell">
              <span className="tiny muted">In</span>
              <span className="money-value money-positive">{formatMoney(income)}</span>
            </div>
            <div className="money-cell">
              <span className="tiny muted">Out</span>
              <span className="money-value money-negative">{formatMoney(spend.total)}</span>
            </div>
          </div>

          <div className="money-split tiny muted">
            Bank {formatMoney(spend.bank)} · Cards {formatMoney(spend.card)}
            {cardDebt > 0 ? ` · Owed ${formatMoney(cardDebt)}` : ''}
          </div>

          {income > 0 && (
            <div style={{ marginTop: 8 }}>
              <ProgressBar
                value={burn}
                color={burn > 0.9 ? 'var(--error)' : burn > 0.7 ? 'var(--warning)' : 'var(--success)'}
              />
              <div className="tiny muted" style={{ marginTop: 4 }}>
                {Math.round(burn * 100)}% of this month&apos;s income spent
              </div>
            </div>
          )}
        </SectionCard>
      )
    }

    if (section === 'Notes') {
      return (
        <SectionCard
          key={section}
          icon={<StickyNote size={16} />}
          title="Notes"
          meta={`${(notes ?? []).length} total`}
          open={open}
          onToggle={onToggle}
          action={<OpenLink onClick={() => navigate('/notes')} />}
        >
          {recentNotes.length === 0 ? (
            <EmptyLine
              icon={<StickyNote size={16} />}
              text="No notes yet"
              action={
                <button className="btn btn-sm btn-outline" onClick={() => navigate('/notes')}>
                  New
                </button>
              }
            />
          ) : (
            <div className="note-mini-list">
              {recentNotes.slice(0, 2).map((note) => (
                <button
                  key={note.id}
                  className="note-mini"
                  onClick={() => navigate(`/notes/${note.id}`)}
                >
                  <span className="bold truncate">{note.title}</span>
                  <span className="tiny muted truncate">
                    {note.content ? noteSnippet(note.content, 90) : 'Empty note'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      )
    }

    if (section === 'Goals') {
      return (
        <SectionCard
          key={section}
          icon={<Flag size={16} />}
          title="Goals"
          meta={activeGoals.length > 0 ? `${activeGoals.length} active` : undefined}
          open={open}
          onToggle={onToggle}
          action={<OpenLink onClick={() => navigate('/goals')} />}
        >
          {activeGoals.length === 0 ? (
            <EmptyLine
              icon={<Flag size={16} />}
              text="No active goals"
              action={
                <button className="btn btn-sm btn-outline" onClick={() => navigate('/goals')}>
                  Set one
                </button>
              }
            />
          ) : (
            <div className="goal-mini-list">
              {activeGoals.slice(0, 2).map((goal) => {
                const pct = Math.max(0, Math.min(1, goal.progress))
                return (
                  <div key={goal.id} className="goal-mini">
                    <div className="row-between" style={{ marginBottom: 4 }}>
                      <span className="truncate">{goal.title}</span>
                      <span className="tiny bold" style={{ color: 'var(--primary)' }}>
                        {Math.round(pct * 100)}%
                      </span>
                    </div>
                    <ProgressBar value={pct} />
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      )
    }

    return (
      <SectionCard
        key={section}
        icon={<Timer size={16} />}
        title="Focus"
        meta={focusMinutes > 0 ? formatDuration(focusMinutes) : 'not started'}
        open={open}
        onToggle={onToggle}
        action={<OpenLink onClick={() => navigate('/pomodoro')} />}
      >
        <div className="row-between">
          <div>
            <div className="focus-total">{focusMinutes > 0 ? formatDuration(focusMinutes) : '0m'}</div>
            <div className="tiny muted">
              focused today
              {focusToday.length > 0 ? ` · ${plural(focusToday.length, 'session')}` : ''}
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/pomodoro')}>
            <Timer size={15} /> Start focus
          </button>
        </div>
      </SectionCard>
    )
  }

  return (
    <div className="home">
      <header className="home-hero">
        <div className="home-hero-text">
          <div className="home-date">
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <h1 className="home-greeting">
            {greeting}, {firstName}
          </h1>
          <p className="home-status">{statusLine}</p>
        </div>

        <ProgressRing value={progress} label="Today's progress" size={72}>
          <span className="ring-value">
            {totalToday === 0 ? '—' : `${doneToday}/${totalToday}`}
          </span>
          <span className="ring-caption">today</span>
        </ProgressRing>
      </header>

      <div className="quick-actions" role="group" aria-label="Quick actions">
        <button className="quick-action primary" onClick={() => setShowAddTask(true)}>
          <Plus size={16} /> Task
        </button>
        <button className="quick-action" onClick={() => setShowAddSpend(true)}>
          <ArrowUpRight size={16} /> Spend
        </button>
        <button className="quick-action" onClick={() => navigate('/pomodoro')}>
          <Timer size={16} /> Focus
        </button>
        <button className="quick-action" onClick={() => navigate('/notes')}>
          <StickyNote size={16} /> Note
        </button>
      </div>

      {sections.length === 0 && (
        <div className="card">
          <div className="bold">All home sections are hidden</div>
          <div className="small muted" style={{ marginTop: 4 }}>
            Turn sections back on in Settings → Home Page.
          </div>
          <button
            className="btn btn-sm btn-outline"
            style={{ marginTop: 10 }}
            onClick={() => navigate('/settings')}
          >
            <Settings size={14} /> Open settings
          </button>
        </div>
      )}

      <div className="home-sections">{sections.map(renderSection)}</div>

      {showAddTask && (
        <TaskDialog
          onClose={() => setShowAddTask(false)}
          onSave={async (task) => {
            await db.tasks.add(task)
            setShowAddTask(false)
          }}
        />
      )}
      {showAddSpend && (
        <TransactionDialog type="Expense" onClose={() => setShowAddSpend(false)} />
      )}
    </div>
  )
}

// ------------------------------------------------------------------ pieces

function SectionCard({
  icon,
  title,
  meta,
  open,
  onToggle,
  action,
  children,
}: {
  icon: ReactNode
  title: string
  meta?: string
  open: boolean
  onToggle: () => void
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="card home-section">
      <CollapsibleHeader
        title={title}
        icon={icon}
        meta={meta}
        open={open}
        onToggle={onToggle}
        action={action}
      />
      {open && <div className="home-section-body">{children}</div>}
    </section>
  )
}

function OpenLink({ onClick }: { onClick: () => void }) {
  return (
    <button className="home-open" onClick={onClick}>
      Open
    </button>
  )
}

function EmptyLine({
  icon,
  text,
  action,
}: {
  icon: ReactNode
  text: string
  action?: ReactNode
}) {
  return (
    <div className="empty-line">
      <span className="empty-line-icon">{icon}</span>
      <span className="grow small muted">{text}</span>
      {action}
    </div>
  )
}

function TaskGroup({
  label,
  tone,
  tasks,
  limit,
  hint,
  onComplete,
  more,
}: {
  label: string
  tone: 'error' | 'primary' | 'muted'
  tasks: Task[]
  limit: number
  hint?: (task: Task) => string
  onComplete: (task: Task) => void
  more?: () => void
}) {
  if (tasks.length === 0) return null
  const visible = tasks.slice(0, limit)
  const hidden = tasks.length - visible.length
  const color =
    tone === 'error' ? 'var(--error)' : tone === 'primary' ? 'var(--primary)' : 'var(--muted)'

  return (
    <div className="task-group">
      <div className="task-group-label" style={{ color }}>
        {label} ({tasks.length})
      </div>
      {visible.map((task) => (
        <div key={task.id} className="home-task">
          <button
            className="task-check"
            aria-label={`Complete ${task.title}`}
            onClick={() => onComplete(task)}
          >
            <Check size={13} />
          </button>
          <div className="home-task-body">
            <div className="home-task-title truncate">{task.title}</div>
            {hint && <div className="tiny muted">{hint(task)}</div>}
          </div>
          {task.priority === 'High' && (
            <span className={`badge ${priorityClass(task.priority)}`}>{task.priority}</span>
          )}
        </div>
      ))}
      {hidden > 0 && (
        <button className="task-more" onClick={more}>
          +{hidden} more
        </button>
      )}
    </div>
  )
}

/** "Today" / "Tomorrow" / "Mon, Nov 3" for an event, including multi-day runs. */
function dayLabel(event: ClarityEvent, todayKey: string): string {
  const startKey = toDateKey(event.startDate)
  const endKey = toDateKey(event.endDate)
  if (startKey <= todayKey && endKey >= todayKey) return 'Today'
  if (startKey === toDateKey(addDays(fromDateKey(todayKey), 1))) return 'Tomorrow'
  return new Date(event.startDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
