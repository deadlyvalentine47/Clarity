import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import type { Event } from '../db/types'
import {
  MONTHS,
  endOfDay,
  formatTime,
  startOfDay,
  toDateKey,
} from '../lib/dates'
import { ConfirmDialog, Dialog, EmptyState, Field, TextArea, TextInput } from '../components/ui'

export default function CalendarScreen() {
  const today = new Date()
  const [selected, setSelected] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [showAll, setShowAll] = useState(false)

  const events = useLiveQuery(() => db.events.orderBy('startDate').toArray(), [], [])

  const eventsFor = (d: Date) => {
    const start = startOfDay(d.getTime())
    const end = endOfDay(d.getTime())
    // Overlap, so multi-day events show on every day they span.
    return (events ?? []).filter((e) => e.startDate <= end && (e.endDate || e.startDate) >= start)
  }

  const dayEvents = eventsFor(selected)

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

  const eventDates = useMemo(() => new Set((events ?? []).map((e) => toDateKey(e.startDate))), [events])

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
    setShowAll(false)
  }

  if (showAll) {
    return (
      <>
        <div className="row" style={{ marginBottom: 16 }}>
          <button className="icon-btn" aria-label="Back" onClick={() => setShowAll(false)}>
            <ChevronLeft size={22} />
          </button>
          <div>
            <h1 className="page-title" style={{ fontSize: 20 }}>
              {selected.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
            </h1>
            <p className="page-sub">{dayEvents.length} events</p>
          </div>
        </div>
        {dayEvents.length === 0 ? (
          <EmptyState icon={<CalendarDays size={40} />} title="No events for this day" />
        ) : (
          <div className="stack">
            {dayEvents.map((e) => (
              <EventItem key={e.id} event={e} onEdit={() => setEditing(e)} />
            ))}
          </div>
        )}
        {editing && <EventDialog key={editing.id} event={editing} date={selected} onClose={() => setEditing(null)} />}
      </>
    )
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
        {dayEvents.length > 3 && (
          <button className="btn btn-sm btn-outline" onClick={() => setShowAll(true)}>
            View all {dayEvents.length} events
          </button>
        )}
      </div>

      {dayEvents.length === 0 ? (
        <div className="card">
          <div className="small muted">No events</div>
        </div>
      ) : (
        <div className="stack">
          {dayEvents.slice(0, 3).map((e) => (
            <EventItem key={e.id} event={e} onEdit={() => setEditing(e)} />
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

function EventItem({ event, onEdit }: { event: Event; onEdit: () => void }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row">
        <div
          className="color-dot"
          style={{ background: event.color || 'var(--primary)', width: 12, height: 12 }}
        />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="bold">{event.title}</div>
          {event.description && <div className="small muted">{event.description}</div>}
        </div>
        <span className="small muted">{formatTime(event.startDate)}</span>
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
        message={`Are you sure you want to delete "${event.title}"?`}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          if (event.id != null) void db.events.delete(event.id)
          setConfirm(false)
        }}
      />
    </div>
  )
}

function EventDialog({
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

  const save = () => {
    if (!title.trim()) return
    if (editing && event) {
      void db.events.put({ ...event, title: title.trim(), description: description.trim() })
    } else {
      const start = startOfDay(date.getTime())
      void db.events.add({
        title: title.trim(),
        description: description.trim(),
        startDate: start,
        endDate: start + 3_600_000,
        category: '',
        color: '#4A90D9',
        isAllDay: false,
        reminderTime: null,
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
          <button className="btn btn-primary" onClick={save} disabled={!title.trim()}>
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
        <div className="tiny muted">
          {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
    </Dialog>
  )
}
