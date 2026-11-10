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
  eventNote,
  eventOccursOn,
  eventOccurrence,
  eventStatus,
  shiftEventDateMaps,
  skipEventOccurrence,
  toggleEventCompletion,
  updateEventNote,
} from '../db/events'
import {
  MONTHS,
  addDays,
  combineDateTime,
  daysBetween,
  formatDateKey,
  formatTime,
  fromDateKey,
  timeValue,
  toDateKey,
} from '../lib/dates'
import { useSavedFlash } from '../hooks/useSavedFlash'
import MarkdownPreview from '../components/MarkdownPreview'
import {
  ConfirmDialog,
  DateField,
  Dialog,
  EmptyState,
  Field,
  FieldGroup,
  ListSkeleton,
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

  const events = useLiveQuery(() => db.events.orderBy('startDate').toArray(), [])

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

  if (events === undefined) return <ListSkeleton rows={3} />

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
          Scheduled for {formatDateKey(toDateKey(selected), true)}
        </span>
      </div>

      {dayEvents.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title="No events"
          subtitle="Nothing scheduled for this day."
        />
      ) : (
        <div className="stack">
          {dayEvents.map((e) => (
            <EventItem
              key={`${e.id}-${toDateKey(selected)}`}
              event={e}
              date={selected}
              onEdit={() => setEditing(e)}
            />
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
  const [expanded, setExpanded] = useState(() => eventNote(event, date).trim() !== '')
  const [note, setNote] = useState(() => eventNote(event, date))
  const [saved, flashSaved] = useSavedFlash()
  const occurrence = eventOccurrence(event, date)
  const status = eventStatus(event, date)
  const done = status === 'done'
  const storedNote = eventNote(event, date)
  const occurrenceLabel = formatDateKey(toDateKey(date), true)

  const saveNote = async () => {
    if (event.id == null) return
    await updateEventNote(event.id, date, note)
    flashSaved()
  }

  return (
    <div
      className="card"
      style={{ padding: 14, opacity: done ? 0.72 : 1, cursor: 'pointer' }}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${event.title}`}
      onClick={() => setExpanded((v) => !v)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setExpanded((v) => !v)
        }
      }}
    >
      <div className="row">
        <button
          className={`event-check ${done ? 'done' : ''}`}
          aria-label={done ? `Mark ${event.title} not completed` : `Mark ${event.title} completed`}
          aria-pressed={done}
          onClick={(e) => {
            e.stopPropagation()
            if (event.id != null) void toggleEventCompletion(event.id, date, !done)
          }}
        >
          {done ? <Check size={13} /> : <Circle size={13} />}
        </button>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="bold" style={{ textDecoration: done ? 'line-through' : undefined }}>
            {event.title}
          </div>
          {event.description && (
            <div className="small muted">
              <MarkdownPreview content={event.description} />
            </div>
          )}
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
                Due {formatDateKey(toDateKey(event.dueDate), true)}
              </span>
            )}
          </div>
        </div>
        <span className="small muted">{formatTime(occurrence.start)}</span>
        <button
          className="icon-btn"
          style={{ width: 32, height: 32 }}
          aria-label="Edit event"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          <Pencil size={15} />
        </button>
        <button
          className="icon-btn"
          style={{ width: 32, height: 32 }}
          aria-label="Delete event"
          onClick={(e) => {
            e.stopPropagation()
            setConfirm(true)
          }}
        >
          <Trash2 size={15} color="var(--error)" />
        </button>
      </div>

      {!expanded && storedNote && (
        <div className="small muted truncate" style={{ marginTop: 8, paddingLeft: 26 }}>
          {storedNote}
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
          <hr className="hr" />
          <TextArea
            value={note}
            onValueChange={setNote}
            placeholder="Notes for this day — what you're working on and what's pending"
            preview="below"
          />
          <div className="row-between" style={{ marginTop: 6 }}>
            <span className="tiny muted">{saved ? 'Saved' : ''}</span>
            <button className="btn btn-sm btn-primary" onClick={() => void saveNote()}>
              Save note
            </button>
          </div>
        </div>
      )}

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

type EventFormFields = Pick<
  Event,
  | 'title'
  | 'description'
  | 'startDate'
  | 'endDate'
  | 'priority'
  | 'dueDate'
  | 'frequency'
  | 'alternateDays'
  | 'selectedDays'
  | 'completionHistory'
>

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
  // The dialog edits the occurrence the user opened, not the series anchor.
  const initialDateKey = event
    ? event.frequency
      ? eventCompletionKey(event, date)
      : toDateKey(event.startDate)
    : toDateKey(date)
  const [dateKey, setDateKey] = useState(initialDateKey)
  const [moveChoice, setMoveChoice] = useState<null | {
    fields: EventFormFields
    delta: number
    start: number
    completionKey: string
  }>(null)

  const buildFields = (): {
    fields: EventFormFields
    delta: number
    completionKey: string
  } | null => {
    if (!title.trim() || !dateKey) return null
    const day = fromDateKey(dateKey)
    const freq = frequency === '' ? null : (frequency as HabitFrequency)
    const viewedKey =
      editing && event
        ? event.frequency
          ? eventCompletionKey(event, date)
          : toDateKey(event.startDate)
        : toDateKey(day)
    const delta = editing && event ? daysBetween(fromDateKey(viewedKey), day) : 0

    // Recurring series keep their anchor day: editing the time must not move
    // the series. Only a changed date shifts it, by the same number of days.
    const anchorDay = editing && event ? fromDateKey(toDateKey(event.startDate)) : day
    const seriesDay = editing && event && freq ? addDays(anchorDay, delta) : day
    const start = combineDateTime(seriesDay, startTime)
    let end = combineDateTime(seriesDay, endTime)
    if (end <= start) {
      // An earlier end time means the occurrence runs past midnight.
      end = combineDateTime(addDays(seriesDay, 1), endTime)
      if (end <= start) end = start + 3_600_000
    }

    const key = toDateKey(start)
    const history =
      editing && event && freq && delta !== 0
        ? shiftEventDateMaps(event, delta).completionHistory
        : { ...(event?.completionHistory ?? {}) }

    if (editing && event && !freq) {
      if (viewedKey !== key) delete history[viewedKey]
    }

    // A recurring event is completed per occurrence: keep the mark attached to
    // the occurrence the dialog was opened from, shifted with the series.
    const completionKey = freq ? toDateKey(addDays(fromDateKey(viewedKey), delta)) : key
    if (completed) history[completionKey] = true
    else delete history[completionKey]

    // A due date the user has not edited follows the event's new day.
    let nextDue: number | null = freq ? null : dueDate ? fromDateKey(dueDate).getTime() : null
    if (
      !freq &&
      nextDue != null &&
      delta !== 0 &&
      event?.dueDate != null &&
      dueDate === toDateKey(event.dueDate)
    ) {
      nextDue = addDays(new Date(nextDue), delta).getTime()
    }

    return {
      delta,
      completionKey,
      fields: {
        title: title.trim(),
        description: description.trim(),
        startDate: start,
        endDate: end,
        priority: priority === '' ? null : priority,
        dueDate: nextDue,
        frequency: freq,
        alternateDays: freq === 'Alternate' ? Math.max(1, Number(alternateDays) || 1) : null,
        selectedDays: freq === 'Custom' ? [...selectedDays].sort((a, b) => a - b) : null,
        completionHistory: history,
      },
    }
  }

  const save = async () => {
    const result = buildFields()
    if (!result) return
    const { fields, delta, completionKey } = result

    if (editing && event?.id != null) {
      if (event.frequency && fields.frequency && delta !== 0) {
        setMoveChoice({ fields, delta, start: fields.startDate, completionKey })
        return
      }
      await db.events.put({ ...event, ...fields })
    } else {
      await db.events.add({
        ...fields,
        category: '',
        color: '#4A90D9',
        isAllDay: false,
        reminderTime: null,
        skippedDates: {},
        eventNotes: {},
        createdAt: Date.now(),
      })
    }
    onClose()
  }

  const moveSeries = async () => {
    if (!moveChoice || event?.id == null) return
    const maps = shiftEventDateMaps(event, moveChoice.delta)
    const history = { ...maps.completionHistory }
    if (completed) history[moveChoice.completionKey] = true
    else delete history[moveChoice.completionKey]
    await db.events.put({
      ...event,
      ...moveChoice.fields,
      completionHistory: history,
      skippedDates: maps.skippedDates,
      eventNotes: maps.eventNotes,
    })
    setMoveChoice(null)
    onClose()
  }

  const moveOccurrence = async () => {
    if (!moveChoice || event?.id == null) return
    const occurrenceKey = eventCompletionKey(event, date)
    const skippedDates = { ...(event.skippedDates ?? {}), [occurrenceKey]: true }
    const history = { ...(event.completionHistory ?? {}) }
    const wasDone = history[occurrenceKey] === true || completed
    delete history[occurrenceKey]
    await db.transaction('rw', db.events, async () => {
      await db.events.update(event.id!, { skippedDates, completionHistory: history })
      await db.events.add({
        ...moveChoice.fields,
        frequency: null,
        alternateDays: null,
        selectedDays: null,
        completionHistory: wasDone ? { [toDateKey(moveChoice.start)]: true } : {},
        category: event.category,
        color: event.color,
        isAllDay: event.isAllDay,
        reminderTime: null,
        skippedDates: {},
        eventNotes: {},
        createdAt: Date.now(),
      })
    })
    setMoveChoice(null)
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? 'Edit Event' : 'Add Event'}
      footer={
        moveChoice ? undefined : (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => void save()} disabled={!title.trim() || !dateKey}>
              {editing ? 'Save' : 'Add'}
            </button>
          </div>
        )
      }
    >
      <div className="stack">
        {moveChoice && (
          <div className="card" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
            <div className="bold">Move a repeating event</div>
            <p className="small muted" style={{ marginTop: 4 }}>
              “{title.trim() || event?.title}” repeats. Move the whole series to{' '}
              {formatDateKey(dateKey, true)}, or move only this occurrence.
            </p>
            <div className="row wrap" style={{ marginTop: 8 }}>
              <button className="btn btn-sm btn-primary" onClick={() => void moveSeries()}>
                Move whole series
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => void moveOccurrence()}>
                Move this occurrence only
              </button>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => {
                  setDateKey(initialDateKey)
                  setMoveChoice(null)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <Field label="Title *">
          <TextInput autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Description">
          <TextArea
            value={description}
            onValueChange={setDescription}
            size="sm"
            autoGrow={false}
          />
        </Field>
        <Field label="Date">
          <DateField value={dateKey} onChange={setDateKey} />
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
          <FieldGroup label="Days">
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
          </FieldGroup>
        )}

        {frequency === '' && (
          <Field label="Due date">
            <DateField value={dueDate} onChange={setDueDate} ariaLabel="Due date" />
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

        {frequency !== '' && (
          <p className="tiny muted">
            Each occurrence is completed separately and turns overdue the day after it is missed.
          </p>
        )}
      </div>
    </Dialog>
  )
}
