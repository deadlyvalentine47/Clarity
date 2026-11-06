import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { db } from '../db/db'
import type { Event, HabitFrequency, Priority } from '../db/types'
import {
  EVENT_FREQUENCIES,
  EVENT_WEEKDAY_NAMES,
  eventCompletionKey,
  eventFrequencyLabel,
  eventOccursOn,
  eventOccurrence,
  eventStatus,
  skipEventOccurrence,
  toggleEventCompletion,
} from '../db/events'
import { MONTHS, formatTime, fromDateKey, toDateKey } from '../lib/dates'
import {
  ConfirmDialog,
  Dialog,
  Field,
  Select,
  TextArea,
  TextInput,
  priorityClass,
} from '../components/ui'

export default function CalendarScreen() {
  const today = new Date()
  const [selected, setSelected] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)

  const events = useLiveQuery(() => db.events.orderBy('startDate').toArray(), [], [])

  const dayEvents = useMemo(
    () =>
      (events ?? [])
        .filter((e) => eventOccursOn(e, selected))
        .sort((a, b) => eventOccurrence(a, selected).start - eventOccurrence(b, selected).start),
    [events, selected],
  )

  const grid = useMemo(() => {
    const first = new Date(year, month - 1, 1)
    const firstDay = first.getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month - 1, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [month, year])

  const eventDates = useMemo(() => {
    const set = new Set<string>()
    for (const date of grid) {
      if (date && (events ?? []).some((e) => eventOccursOn(e, date))) set.add(toDateKey(date))
    }
    return set
  }, [events, grid])

  const shiftMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m < 1) {
      m = 12
      y--
    } else if (m > 12) {
      m = 1
      y++
    }
    setMonth(m)
    setYear(y)
  }

  const goToday = () => {
    const now = new Date()
    setMonth(now.getMonth() + 1)
    setYear(now.getFullYear())
    setSelected(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  }

  return (
    <>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-sub">
            {MONTHS[month - 1]} {year}
          </p>
        </div>
        <button className="btn btn-sm btn-outline" onClick={goToday}>
          <CalendarDays size={15} /> Today
        </button>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <div className="row">
            <button className="icon-btn" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={20} />
            </button>
            <select
              className="select"
              style={{ width: 'auto', padding: '6px 10px' }}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              aria-label="Month"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m.slice(0, 3)}
                </option>
              ))}
            </select>
            <select
              className="select"
              style={{ width: 'auto', padding: '6px 10px' }}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Year"
            >
              {Array.from({ length: 21 }, (_, i) => today.getFullYear() - 10 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button className="icon-btn" aria-label="Next month" onClick={() => shiftMonth(1)}>
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="cal-grid" style={{ marginBottom: 4 }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="cal-head">
              {d}
            </div>
          ))}
        </div>

        <div className="cal-grid">
          {grid.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} />
            const isToday = toDateKey(date) === toDateKey(today)
            const isSelected = toDateKey(date) === toDateKey(selected)
            const hasEvents = eventDates.has(toDateKey(date))
            return (
              <button
                key={toDateKey(date)}
                className={`cal-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                style={{ alignItems: 'center', justifyContent: 'center', border: 'none', minHeight: 42, background: isSelected ? 'var(--primary)' : undefined, color: isSelected ? 'var(--on-primary)' : undefined }}
                onClick={() => setSelected(date)}
                aria-label={date.toDateString()}
                aria-pressed={isSelected}
              >
                <span className="cal-day">{date.getDate()}</span>
                {hasEvents && (
                  <span
                    className="color-dot"
                    style={{ background: isSelected ? 'var(--on-primary)' : 'var(--primary)' }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="row-between" style={{ marginBottom: 8 }}>
        <span className="section-label">
          Scheduled for {selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {dayEvents.length === 0 ? (
        <div className="card">
          <div className="small muted">No events</div>
        </div>
      ) : (
        <div className="stack">
          {dayEvents.map((e) => (
            <EventItem key={e.id} event={e} date={selected} onEdit={() => setEditing(e)} />
          ))}
        </div>
      )}

      <button className="fab" aria-label="Add event" onClick={() => setShowAdd(true)}>
        <Plus size={26} />
      </button>

      {showAdd && <EventDialog date={selected} onClose={() => setShowAdd(false)} />}
      {editing && <EventDialog key={editing.id} event={editing} date={selected} onClose={() => setEditing(null)} />}
    </>
  )
}

function EventItem({ event, date, onEdit }: { event: Event; date: Date; onEdit: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const occurrence = eventOccurrence(event, date)
  const status = eventStatus(event, date)
  const done = status === 'done'
  const occurrenceLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="card" style={{ padding: 14, opacity: done ? 0.72 : 1 }}>
      <div className="row">
        <button
          className={`event-check ${done ? 'done' : ''}`}
          aria-label={done ? `Mark ${event.title} not completed` : `Mark ${event.title} completed`}
          aria-pressed={done}
          onClick={() => {
            if (event.id != null) void toggleEventCompletion(event.id, date, !done)
          }}
        >
          {done ? <Check size={13} /> : <Circle size={13} />}
        </button>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="bold" style={{ textDecoration: done ? 'line-through' : undefined }}>
            {event.title}
          </div>
          {event.description && <div className="small muted">{event.description}</div>}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {event.priority && (
              <span className={`badge ${priorityClass(event.priority)}`}>{event.priority}</span>
            )}
            {event.frequency && <span className="badge">{eventFrequencyLabel(event)}</span>}
            {status !== 'upcoming' && (
              <span
                className={`badge ${
                  status === 'overdue' ? 'high' : status === 'due' ? 'medium' : 'low'
                }`}
              >
                {status === 'overdue' ? 'Overdue' : status === 'due' ? 'Due today' : 'Done'}
              </span>
            )}
            {!event.frequency && event.dueDate != null && (
              <span className="badge">
                Due {new Date(event.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        <span className="small muted">{formatTime(occurrence.start)}</span>
        <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Edit event" onClick={onEdit}>
          <Pencil size={15} />
        </button>
        <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Delete event" onClick={() => setConfirm(true)}>
          <Trash2 size={15} color="var(--error)" />
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Delete Event"
        message={
          event.frequency
            ? `Delete "${event.title}" on ${occurrenceLabel} only, or the entire series?`
            : `Are you sure you want to delete "${event.title}"?`
        }
        confirmLabel={event.frequency ? 'Delete series' : 'Delete'}
        alternateAction={
          event.frequency
            ? {
                label: `Delete ${occurrenceLabel}`,
                onClick: () => {
                  if (event.id != null) void skipEventOccurrence(event.id, date)
                  setConfirm(false)
                },
              }
            : undefined
        }
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          if (event.id != null) void db.events.delete(event.id)
          setConfirm(false)
        }}
      />
    </div>
  )
}

function timeValue(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function combineDateTime(date: Date, time: string): number {
  const [h, m] = time.split(':').map(Number)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h || 0, m || 0, 0, 0).getTime()
}

export function EventDialog({
  event,
  date,
  onClose,
}: {
  event?: Event
  date: Date
  onClose: () => void
}) {
  const editing = event != null
  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [startTime, setStartTime] = useState(event ? timeValue(event.startDate) : '09:00')
  const [endTime, setEndTime] = useState(event ? timeValue(event.endDate) : '10:00')
  const [priority, setPriority] = useState<Priority | ''>(event?.priority ?? '')
  const [dueDate, setDueDate] = useState(event?.dueDate != null ? toDateKey(event.dueDate) : '')
  const [frequency, setFrequency] = useState<HabitFrequency | ''>(event?.frequency ?? '')
  const [alternateDays, setAlternateDays] = useState(
    event?.alternateDays != null ? String(event.alternateDays) : '1',
  )
  const [selectedDays, setSelectedDays] = useState<number[]>(event?.selectedDays ?? [])
  const [completed, setCompleted] = useState(
    event ? event.completionHistory?.[eventCompletionKey(event, date)] === true : false,
  )

  const save = async () => {
    if (!title.trim()) return
    const start = combineDateTime(date, startTime)
    let end = combineDateTime(date, endTime)
    if (end <= start) end = start + 3_600_000
    const freq = frequency === '' ? null : (frequency as HabitFrequency)
    const history = { ...(event?.completionHistory ?? {}) }
    const key = freq ? toDateKey(date) : toDateKey(start)
    if (editing && event && !freq) {
      const oldKey = toDateKey(event.startDate)
      if (oldKey !== key) delete history[oldKey]
    }
    if (completed) history[key] = true
    else delete history[key]

    const fields = {
      title: title.trim(),
      description: description.trim(),
      startDate: start,
      endDate: end,
      priority: priority === '' ? null : priority,
      dueDate: freq ? null : dueDate ? fromDateKey(dueDate).getTime() : null,
      frequency: freq,
      alternateDays: freq === 'Alternate' ? Math.max(1, Number(alternateDays) || 1) : null,
      selectedDays: freq === 'Custom' ? [...selectedDays].sort((a, b) => a - b) : null,
      completionHistory: history,
    }

    if (editing && event?.id != null) {
      await db.events.put({ ...event, ...fields })
    } else {
      await db.events.add({
        ...fields,
        category: '',
        color: '#4A90D9',
        isAllDay: false,
        reminderTime: null,
        skippedDates: {},
        createdAt: Date.now(),
      })
    }
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? 'Edit Event' : 'Add Event'}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!title.trim()}>
            {editing ? 'Save' : 'Add'}
          </button>
        </div>
      }
    >
      <div className="stack">
        <Field label="Title *">
          <TextInput autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Description">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 80 }} />
        </Field>
        <div className="grid-2">
          <Field label="Start time">
            <TextInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="End time">
            <TextInput type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>

        <Field label="Priority">
          <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')}>
            <option value="">None</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </Select>
        </Field>

        <Field label="Repeat">
          <Select value={frequency} onChange={(e) => setFrequency(e.target.value as HabitFrequency | '')}>
            {EVENT_FREQUENCIES.map((f) => (
              <option key={f.value || 'none'} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>

        {frequency === 'Alternate' && (
          <Field label="Skip days between (1 = every other day)">
            <TextInput
              type="number"
              inputMode="numeric"
              min={1}
              value={alternateDays}
              onChange={(e) => setAlternateDays(e.target.value)}
            />
          </Field>
        )}

        {frequency === 'Custom' && (
          <Field label="Days">
            <div className="pill-list">
              {EVENT_WEEKDAY_NAMES.map((label, i) => {
                const day = i + 1
                const active = selectedDays.includes(day)
                return (
                  <button
                    key={label}
                    className={`chip ${active ? 'active' : ''}`}
                    aria-pressed={active}
                    onClick={() =>
                      setSelectedDays((prev) =>
                        active ? prev.filter((d) => d !== day) : [...prev, day],
                      )
                    }
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </Field>
        )}

        {frequency === '' && (
          <Field label="Due date">
            <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        )}

        <div className="row-between">
          <span className="label">Completed</span>
          <button
            className={`switch ${completed ? 'on' : ''}`}
            aria-label="Mark completed"
            aria-pressed={completed}
            onClick={() => setCompleted((v) => !v)}
          />
        </div>

        <div className="tiny muted">
          {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        {frequency !== '' && (
          <p className="tiny muted">
            Each occurrence is completed separately and turns overdue the day after it is missed.
          </p>
        )}
      </div>
    </Dialog>
  )
}
