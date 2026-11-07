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
  Footprints,
  Plus,
  Settings,
  StickyNote,
  Wallet,
} from 'lucide-react'
import { db } from '../db/db'
import { goalProgress, goalStatus } from '../db/goals'
import type { Event as ClarityEvent, Habit, HomeSection } from '../db/types'
import { usePreferences } from '../context/PreferencesContext'
import { isScheduledOn, toggleHabitForDate } from '../db/habits'
import { buildTopLevelRows } from '../db/habitGroups'
import {
  eventCompletionKey,
  eventDueKey,
  eventFrequencyLabel,
  eventOccursOn,
  eventOccurrence,
  eventStatus,
  overdueOccurrences,
  toggleEventCompletion,
} from '../db/events'
import { noteSnippet } from '../db/notes'
import { cardPurchasesInCycle, isSelfTransfer, spendSummary, summarizeBudget } from '../db/budget'
import {
  addDays,
  endOfDay,
  formatTime,
  fromDateKey,
  greetingFor,
  monthRange,
  startOfDay,
  toDateKey,
} from '../lib/dates'
import { formatMoney, plural } from '../lib/format'
import { distanceLabel, formatClock } from '../lib/geo'
import { CollapsibleHeader, ProgressBar, ProgressRing } from '../components/ui'
import { EventDialog } from './CalendarScreen'
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
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [showAddSpend, setShowAddSpend] = useState(false)

  const now = new Date()
  const todayKey = toDateKey(now)
  const dayStart = startOfDay(now.getTime())
  const dayEnd = endOfDay(now.getTime())
  const [monthStart, monthEnd] = monthRange(now.getFullYear(), now.getMonth() + 1)

  // Monday-based week, matching the Runs screen's "This week" range.
  const weekStart = useMemo(() => {
    const start = new Date(now)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    start.setHours(0, 0, 0, 0)
    return start.getTime()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey])

  const habits = useLiveQuery(async () => db.habits.toArray(), [], [])
  const habitGroups = useLiveQuery(async () => db.habitGroups.toArray(), [], [])
  const events = useLiveQuery(async () => db.events.toArray(), [], [])
  const transactions = useLiveQuery(async () => db.transactions.toArray(), [], [])
  const cardTxns = useLiveQuery(async () => db.creditCardTransactions.toArray(), [], [])
  const sources = useLiveQuery(async () => db.sources.toArray(), [], [])
  const cards = useLiveQuery(async () => db.creditCards.toArray(), [], [])
  const notes = useLiveQuery(async () => db.notes.toArray(), [], [])
  const goals = useLiveQuery(async () => db.goals.toArray(), [], [])
  const runs = useLiveQuery(async () => db.runs.orderBy('startedAt').reverse().toArray(), [], [])

  // --------------------------------------------------------------- habits
  // sortOrder is only unique inside a group, so a flat sort interleaves groups.
  // Flatten the same top-level rows the Habits screen uses instead.
  const activeHabits = buildTopLevelRows(
    (habits ?? []).filter((h) => !h.isArchived && !h.isDeleted),
    habitGroups ?? [],
  ).flatMap((row) => (row.kind === 'group' ? row.habits : [row.habit]))
  // Skipped days are not tracked: they leave the list and the progress
  // denominator alone.
  const habitsToday = activeHabits.filter(
    (h) => isScheduledOn(h, now) && !h.skippedDates?.[todayKey],
  )
  const habitsDone = habitsToday.filter((h) => h.completionHistory[todayKey] === true).length
  // Completed (including late) habits leave the home list; the underlying
  // habit stays untouched in the Habits screen.
  const habitsPending = habitsToday.filter((h) => h.completionHistory[todayKey] !== true)

  // --------------------------------------------------------------- events
  const todayEvents = sortEventsByTime((events ?? []).filter((e) => eventOccursOn(e, now)))
  const eventsDone = todayEvents.filter(
    (e) => e.completionHistory?.[eventCompletionKey(e, now)] === true,
  ).length
  const allTodayDone = todayEvents.length > 0 && eventsDone === todayEvents.length

  // One row per overdue event, listing every missed due date oldest-first.
  // Checking the row completes the oldest miss and the list re-renders.
  const overdueItems = (events ?? [])
    .flatMap((event) => {
      const missed = overdueOccurrences(event, now)
      return missed.length === 0
        ? []
        : [{ event, occurrence: missed[0], missedDates: missed }]
    })
    .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime())

  // Once today is cleared (or empty), the card rolls over to the next two days.
  const showUpcoming = allTodayDone || todayEvents.length === 0
  const tomorrow = addDays(now, 1)
  const dayAfterTomorrow = addDays(now, 2)
  const tomorrowEvents = sortEventsByTime(
    (events ?? []).filter(
      (e) =>
        eventOccursOn(e, tomorrow) &&
        e.completionHistory?.[eventCompletionKey(e, tomorrow)] !== true,
    ),
  )
  const dayAfterEvents = sortEventsByTime(
    (events ?? []).filter(
      (e) =>
        eventOccursOn(e, dayAfterTomorrow) &&
        e.completionHistory?.[eventCompletionKey(e, dayAfterTomorrow)] !== true,
    ),
  )
  const upcomingTotal = tomorrowEvents.length + dayAfterEvents.length

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
  const totals = summarizeBudget({ sources: sources ?? [], cardTxns: cardTxns ?? [] })
  const bankBalance = totals.bankBalance
  const cardDebt = totals.cardDebt

  const activeGoals = (goals ?? []).filter((g) => goalStatus(g) !== 'Completed')
  const recentNotes = [...(notes ?? [])].sort((a, b) => b.updatedAt - a.updatedAt)

  // ---------------------------------------------------------------- today
  const doneToday = habitsDone + eventsDone
  const totalToday = habitsToday.length + todayEvents.length
  const progress = totalToday === 0 ? 0 : doneToday / totalToday

  const todoLeft = habitsToday.length - habitsDone + (todayEvents.length - eventsDone)
  const statusLine = (() => {
    const parts: string[] = []
    if (overdueItems.length > 0) parts.push(`${overdueItems.length} overdue`)
    if (todoLeft > 0) parts.push(`${todoLeft} to do today`)
    if (parts.length === 0) {
      if (totalToday > 0) parts.push('All done for today. Nice.')
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

  const toggleHabit = async (habit: Habit) => {
    if (habit.id == null) return
    const done = habit.completionHistory[todayKey] === true
    await toggleHabitForDate(habit.id, todayKey, !done)
  }

  const toggleEvent = async (event: ClarityEvent, date: Date) => {
    if (event.id == null) return
    const done = event.completionHistory?.[eventCompletionKey(event, date)] === true
    await toggleEventCompletion(event.id, date, !done)
  }

  // ---------------------------------------------------------------- runs
  const unit = prefs.distanceUnit
  const weekRuns = (runs ?? []).filter((run) => run.startedAt >= weekStart)
  const weekMeters = weekRuns.reduce((sum, run) => sum + run.distanceMeters, 0)
  const weekSeconds = weekRuns.reduce((sum, run) => sum + run.durationSeconds, 0)
  const latestRun = (runs ?? [])[0]

  const renderSection = (section: HomeSection) => {
    const open = !collapsed.has(section)
    const onToggle = () => toggleSection(section)

    if (section === 'Events') {
      const agendaGroups: Array<{
        key: string
        label?: string
        dateLabel?: string
        tone?: 'overdue'
        items: AgendaItem[]
      }> = []

      if (overdueItems.length > 0) {
        agendaGroups.push({
          key: 'overdue',
          label: 'Overdue',
          tone: 'overdue',
          items: overdueItems,
        })
      }

      if (showUpcoming) {
        if (tomorrowEvents.length > 0) {
          agendaGroups.push({
            key: 'tomorrow',
            label: 'Tomorrow',
            dateLabel: formatGroupDate(tomorrow),
            items: tomorrowEvents.map((event) => ({
              event,
              occurrence: new Date(eventOccurrence(event, tomorrow).start),
            })),
          })
        }
        if (dayAfterEvents.length > 0) {
          agendaGroups.push({
            key: 'day-after',
            label: 'Day after tomorrow',
            dateLabel: formatGroupDate(dayAfterTomorrow),
            items: dayAfterEvents.map((event) => ({
              event,
              occurrence: new Date(eventOccurrence(event, dayAfterTomorrow).start),
            })),
          })
        }
      } else {
        agendaGroups.push({
          key: 'today',
          label: overdueItems.length > 0 ? 'Today' : undefined,
          dateLabel: overdueItems.length > 0 ? formatGroupDate(now) : undefined,
          items: todayEvents.map((event) => ({
            event,
            occurrence: new Date(eventOccurrence(event, now).start),
          })),
        })
      }

      const metaParts: string[] = []
      if (overdueItems.length > 0) metaParts.push(`${overdueItems.length} overdue`)
      if (showUpcoming) {
        if (upcomingTotal > 0) metaParts.push(`${plural(upcomingTotal, 'event')} next up`)
      } else {
        metaParts.push(
          overdueItems.length > 0
            ? `${eventsDone}/${todayEvents.length} today`
            : `Due today ${eventsDone}/${todayEvents.length} events`,
        )
      }

      return (
        <SectionCard
          key={section}
          icon={<CalendarDays size={16} />}
          title="Up next"
          meta={metaParts.join(' · ') || undefined}
          open={open}
          onToggle={onToggle}
          action={<OpenLink onClick={() => navigate('/calendar')} />}
        >
          {agendaGroups.length === 0 ? (
            <EmptyLine
              icon={<CalendarDays size={16} />}
              text="Nothing scheduled for tomorrow"
              action={
                <button className="btn btn-sm btn-outline" onClick={() => navigate('/calendar')}>
                  Add
                </button>
              }
            />
          ) : (
            <div className="agenda">
              {agendaGroups.map((group) => (
                <div key={group.key} className="agenda-group">
                  {group.label && (
                    <div
                      className={`agenda-group-title${group.tone === 'overdue' ? ' overdue' : ''}`}
                    >
                      <span>{group.label}</span>
                      {group.dateLabel && (
                        <span className="agenda-group-date">{group.dateLabel}</span>
                      )}
                    </div>
                  )}
                  {group.items.map((item) => (
                    <AgendaRow
                      key={`${group.key}-${item.event.id}`}
                      event={item.event}
                      occurrence={item.occurrence}
                      missedDates={item.missedDates}
                      now={now}
                      onToggle={() => void toggleEvent(item.event, item.occurrence)}
                      onOpen={() => navigate('/calendar')}
                    />
                  ))}
                </div>
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
          ) : habitsPending.length === 0 ? (
            <EmptyLine
              icon={<Check size={16} />}
              text="All habits done for today"
              action={
                <button className="btn btn-sm btn-outline" onClick={() => navigate('/habits')}>
                  Open
                </button>
              }
            />
          ) : (
            <div className="habit-strip">
              {habitsPending.map((habit) => (
                <button
                  key={habit.id}
                  className="habit-chip"
                  aria-pressed={false}
                  aria-label={`Check ${habit.name}`}
                  onClick={() => void toggleHabit(habit)}
                >
                  <span className="habit-chip-check">
                    <Circle size={14} />
                  </span>
                  <span className="habit-chip-name wrap-anywhere">{habit.name}</span>
                  <span className="habit-chip-streak" title="Current streak">
                    🔥 {habit.currentStreak}
                  </span>
                </button>
              ))}
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
                const pct = goalProgress(goal)
                return (
                  <button
                    key={goal.id}
                    className="goal-mini"
                    onClick={() => navigate(`/goals/${goal.id}`)}
                  >
                    <div className="row-between" style={{ marginBottom: 4 }}>
                      <span className="truncate">{goal.title}</span>
                      <span className="tiny bold" style={{ color: 'var(--primary)' }}>
                        {Math.round(pct * 100)}%
                      </span>
                    </div>
                    <ProgressBar value={pct} />
                  </button>
                )
              })}
            </div>
          )}
        </SectionCard>
      )
    }

    if (section === 'Runs') {
      return (
        <SectionCard
          key={section}
          icon={<Footprints size={16} />}
          title="Runs"
          meta={
            weekRuns.length > 0 ? `${distanceLabel(weekMeters, unit)} this week` : 'none this week'
          }
          open={open}
          onToggle={onToggle}
          action={<OpenLink onClick={() => navigate('/runs')} />}
        >
          {!latestRun ? (
            <EmptyLine
              icon={<Footprints size={16} />}
              text="No runs recorded yet"
              action={
                <button className="btn btn-sm btn-outline" onClick={() => navigate('/runs/live')}>
                  Start
                </button>
              }
            />
          ) : (
            <div className="row-between">
              <div style={{ minWidth: 0 }}>
                <div className="focus-total">{distanceLabel(weekMeters, unit)}</div>
                <div className="tiny muted">
                  this week · {formatClock(weekSeconds)}
                  {weekRuns.length > 0 ? ` · ${plural(weekRuns.length, 'run')}` : ''}
                </div>
                <div className="tiny muted truncate">
                  Last: {latestRun.name?.trim() || 'unnamed'} ·{' '}
                  {distanceLabel(latestRun.distanceMeters, unit)} ·{' '}
                  {formatClock(latestRun.durationSeconds)}
                </div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/runs/live')}
              >
                <Footprints size={15} /> Start run
              </button>
            </div>
          )}
        </SectionCard>
      )
    }

    return null
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
        <button className="quick-action primary" onClick={() => setShowAddEvent(true)}>
          <CalendarDays size={16} /> Event
        </button>
        <button className="quick-action" onClick={() => setShowAddSpend(true)}>
          <ArrowUpRight size={16} /> Spend
        </button>
        <button className="quick-action" onClick={() => navigate('/runs/live')}>
          <Footprints size={16} /> Run
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

      {showAddEvent && <EventDialog date={now} onClose={() => setShowAddEvent(false)} />}
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

type AgendaItem = { event: ClarityEvent; occurrence: Date; missedDates?: Date[] }

function AgendaRow({
  event,
  occurrence,
  missedDates,
  now,
  onToggle,
  onOpen,
}: {
  event: ClarityEvent
  occurrence: Date
  missedDates?: Date[]
  now: Date
  onToggle: () => void
  onOpen: () => void
}) {
  const done = event.completionHistory?.[eventCompletionKey(event, occurrence)] === true
  const status = eventStatus(event, occurrence, now)
  const dueDates = event.frequency
    ? (missedDates ?? [occurrence])
    : [fromDateKey(eventDueKey(event, occurrence))]
  const details = [
    event.priority,
    event.frequency ? eventFrequencyLabel(event) : null,
    status === 'overdue'
      ? `Missed ${formatMissedDates(dueDates, now)}`
      : status === 'done'
        ? 'Done'
        : status === 'due'
          ? 'Due today'
          : null,
  ].filter(Boolean)

  return (
    <div
      className="agenda-row"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen()
      }}
    >
      <button
        className={`event-check ${done ? 'done' : ''}`}
        aria-label={`${done ? 'Uncheck' : 'Check'} ${event.title}`}
        aria-pressed={done}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
      >
        {done ? <Check size={13} /> : <Circle size={13} />}
      </button>
      <span className="agenda-time">
        {event.isAllDay ? 'All day' : formatTime(occurrence.getTime())}
      </span>
      <span className="agenda-rail" style={{ background: event.color || 'var(--primary)' }} />
      <span className="agenda-body">
        <span
          className="agenda-title truncate"
          style={{ textDecoration: done ? 'line-through' : undefined }}
        >
          {event.title}
        </span>
        {details.length > 0 && (
          <span
            className={`tiny muted ${status === 'overdue' ? 'wrap-anywhere' : 'truncate'}`}
          >
            {details.join(' · ')}
          </span>
        )}
      </span>
      <ChevronRight size={16} className="muted" />
    </div>
  )
}

function eventStartMinutes(event: ClarityEvent): number {
  if (event.isAllDay) return -1
  const d = new Date(event.startDate)
  return d.getHours() * 60 + d.getMinutes()
}

function sortEventsByTime(events: ClarityEvent[]): ClarityEvent[] {
  return [...events].sort((a, b) => eventStartMinutes(a) - eventStartMinutes(b))
}

function formatGroupDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** "Nov 4–6, Dec 6–7" — missed due dates grouped by month, oldest first. */
function formatMissedDates(dates: Date[], now: Date): string {
  const groups: Array<{ key: string; label: string; days: number[] }> = []
  for (const date of dates) {
    const key = `${date.getFullYear()}-${date.getMonth()}`
    let group = groups[groups.length - 1]
    if (!group || group.key !== key) {
      group = {
        key,
        label: date.toLocaleDateString('en-US', {
          month: 'short',
          ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
        }),
        days: [],
      }
      groups.push(group)
    }
    group.days.push(date.getDate())
  }
  return groups.map((group) => `${group.label} ${formatDayRuns(group.days)}`).join(', ')
}

/** Collapse consecutive days into ranges: [4, 5, 6, 9] -> "4–6, 9". */
function formatDayRuns(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b)
  const parts: string[] = []
  let runStart = sorted[0]
  let runEnd = sorted[0]
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] === runEnd + 1) {
      runEnd = sorted[i]
      continue
    }
    parts.push(runStart === runEnd ? `${runStart}` : `${runStart}–${runEnd}`)
    runStart = sorted[i]
    runEnd = sorted[i]
  }
  parts.push(runStart === runEnd ? `${runStart}` : `${runStart}–${runEnd}`)
  return parts.join(', ')
}
