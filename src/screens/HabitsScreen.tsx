import { useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Archive,
  ArchiveRestore,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { db } from '../db/db'
import type { Habit, HabitFrequency, HabitGroup } from '../db/types'
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
import {
  buildTopLevelRows,
  createHabitGroup,
  deleteHabitGroup,
  moveHabitToGroup,
  moveTopLevelItem,
  renameHabitGroup,
  setHabitGroupCollapsed,
  type TopItem,
  type TopLevelRow,
} from '../db/habitGroups'
import { formatDateKey, formatLongDate, fromDateKey, toDateKey } from '../lib/dates'
import { stripMarkdownForSnippet } from '../lib/markdown'
import { useDragAutoScroll } from '../lib/dragAutoScroll'
import { ConfirmDialog, Dialog, EmptyState, Field, FieldGroup, ListSkeleton, PageHeader, Select, TextArea, TextInput } from '../components/ui'

type Filter = 'Today' | 'All' | 'Archived'
const FILTERS: Filter[] = ['Today', 'All', 'Archived']

type DragItem = { kind: 'habit'; id: number } | { kind: 'group'; id: number }
type DropPos = 'above' | 'below'

export default function HabitsScreen() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('Today')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [archiving, setArchiving] = useState<Habit | null>(null)
  const [deleting, setDeleting] = useState<Habit | null>(null)
  const [showGroup, setShowGroup] = useState(false)
  const [editingGroup, setEditingGroup] = useState<HabitGroup | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<HabitGroup | null>(null)
  const [dragged, setDragged] = useState<DragItem | null>(null)
  const [habitDrop, setHabitDrop] = useState<{ id: number; pos: DropPos } | null>(null)
  const [groupDrop, setGroupDrop] = useState<{ id: number; pos: DropPos | 'inside' } | null>(null)

  useDragAutoScroll(dragged != null)

  const habits = useLiveQuery(async () => db.habits.toArray(), [])
  const groups = useLiveQuery(async () => db.habitGroups.toArray(), [], [])
  const todayKey = toDateKey(new Date())
  // Derived from the day key so the memo below keeps its identity between
  // renders instead of recomputing on every keystroke.
  const today = useMemo(() => fromDateKey(todayKey), [todayKey])

  const rows = useMemo<TopLevelRow[]>(() => {
    const q = query.trim().toLowerCase()
    const visible = (habits ?? [])
      .filter((h) => (filter === 'Archived' ? h.isArchived && !h.isDeleted : !h.isArchived && !h.isDeleted))
      .filter((h) => filter !== 'Today' || isScheduledOn(h, today))
    if (filter === 'Archived') return buildTopLevelRows(visible, [])

    let groupList = groups ?? []
    let shown = visible
    if (q) {
      const named = new Set(
        groupList.filter((g) => g.name.toLowerCase().includes(q)).map((g) => g.id),
      )
      shown = visible.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q) ||
          (h.groupId != null && named.has(h.groupId)),
      )
      groupList = groupList.filter(
        (g) => named.has(g.id) || shown.some((h) => h.groupId === g.id),
      )
    }
    return buildTopLevelRows(shown, groupList)
  }, [habits, groups, query, filter, today])

  const resetDrag = () => {
    setDragged(null)
    setHabitDrop(null)
    setGroupDrop(null)
  }

  const dropOnHabit = (target: Habit, containerGroupId: number | null, position: DropPos) => {
    if (!dragged || target.id == null || (dragged.kind === 'habit' && dragged.id === target.id)) {
      resetDrag()
      return
    }
    const pos = position === 'above' ? 'before' : 'after'
    if (dragged.kind === 'habit') {
      if (containerGroupId != null) {
        void moveHabitToGroup(dragged.id, containerGroupId, { targetHabitId: target.id, position: pos })
      } else {
        void moveTopLevelItem(dragged, { kind: 'habit', id: target.id }, pos)
      }
    } else {
      const targetItem: TopItem =
        containerGroupId != null
          ? { kind: 'group', id: containerGroupId }
          : { kind: 'habit', id: target.id }
      void moveTopLevelItem(dragged, targetItem, pos)
    }
    resetDrag()
  }

  const dropOnGroup = (groupId: number, position: DropPos | 'inside') => {
    if (!dragged) {
      resetDrag()
      return
    }
    if (dragged.kind === 'habit') {
      void moveHabitToGroup(dragged.id, groupId, { position: 'end' })
      // Show the habit landing so the drop has visible feedback.
      void setHabitGroupCollapsed(groupId, false)
    } else {
      void moveTopLevelItem(
        dragged,
        { kind: 'group', id: groupId },
        position === 'above' ? 'before' : 'after',
      )
    }
    resetDrag()
  }

  const dropToEnd = () => {
    if (!dragged) return
    void moveTopLevelItem(dragged, null)
    resetDrag()
  }

  const habitCardProps = (habit: Habit, containerGroupId: number | null) => ({
    habit,
    todayKey,
    onOpen: () => navigate(`/habits/${habit.id}`),
    onEdit: () => setEditing(habit),
    onArchive: () => setArchiving(habit),
    onUnarchive: () => void unarchiveHabit(habit.id!),
    onDelete: () => setDeleting(habit),
    dragging: dragged?.kind === 'habit' && dragged.id === habit.id,
    dropPos: habitDrop != null && habitDrop.id === habit.id ? habitDrop.pos : null,
    onDragStart: () => {
      setDragged({ kind: 'habit', id: habit.id! })
      setHabitDrop(null)
      setGroupDrop(null)
    },
    onDragEnd: resetDrag,
    onDragOver: (pos: DropPos) => {
      setHabitDrop({ id: habit.id!, pos })
      setGroupDrop(null)
    },
    onDrop: (pos: DropPos) => dropOnHabit(habit, containerGroupId, pos),
  })

  if (habits === undefined || groups === undefined) return <ListSkeleton />

  return (
    <>
      <PageHeader
        title="Habits"
        subtitle={formatLongDate(today)}
        actions={
          <>
            <button className="btn btn-sm btn-outline" onClick={() => setShowGroup(true)}>
              <FolderPlus size={16} /> Group
            </button>
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
        <input
          className="input"
          placeholder="Search habits..."
          aria-label="Search habits"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="chip-row" style={{ marginBottom: 14 }}>
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
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
          {rows.map((row) =>
            row.kind === 'group' ? (
              <HabitGroupCard
                key={`group-${row.group.id}`}
                group={row.group}
                habits={row.habits}
                totalHabits={
                  (habits ?? []).filter(
                    (h) =>
                      h.groupId === row.group.id &&
                      (filter === 'Archived'
                        ? h.isArchived && !h.isDeleted
                        : !h.isArchived && !h.isDeleted),
                  ).length
                }
                emptyText={
                  filter === 'Today'
                    ? 'No habits scheduled today'
                    : query.trim()
                      ? 'No habits match your search'
                      : 'Drag habits here to add them to this group'
                }
                collapsed={row.group.isCollapsed !== false}
                onToggleCollapse={() =>
                  void setHabitGroupCollapsed(row.group.id!, row.group.isCollapsed === false)
                }
                todayKey={todayKey}
                dragKind={dragged?.kind ?? null}
                dragging={dragged?.kind === 'group' && dragged.id === row.group.id}
                dropPos={groupDrop != null && groupDrop.id === row.group.id ? groupDrop.pos : null}
                onDragStart={() => {
                  setDragged({ kind: 'group', id: row.group.id! })
                  setHabitDrop(null)
                  setGroupDrop(null)
                }}
                onDragEnd={resetDrag}
                onDragOver={(pos) => {
                  setGroupDrop({ id: row.group.id!, pos })
                  setHabitDrop(null)
                }}
                onDrop={(pos) => dropOnGroup(row.group.id!, pos)}
                onEditGroup={() => setEditingGroup(row.group)}
                onDeleteGroup={() => setDeletingGroup(row.group)}
              >
                {row.habits.map((habit) => (
                  <HabitCard key={habit.id} {...habitCardProps(habit, row.group.id!)} />
                ))}
              </HabitGroupCard>
            ) : (
              <HabitCard key={row.habit.id} {...habitCardProps(row.habit, null)} />
            ),
          )}
          {dragged != null && (
            <div
              className="drop-end"
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(e) => {
                e.preventDefault()
                dropToEnd()
              }}
            >
              {dragged.kind === 'group' ? 'Move group to the end' : 'Move to the end (outside groups)'}
            </div>
          )}
        </div>
      )}

      <button className="fab" aria-label="Add habit" onClick={() => setShowAdd(true)}>
        <Plus size={26} />
      </button>

      {showAdd && <HabitDialog onClose={() => setShowAdd(false)} />}
      {editing && <HabitDialog habit={editing} onClose={() => setEditing(null)} />}
      {showGroup && <GroupDialog onClose={() => setShowGroup(false)} />}
      {editingGroup && <GroupDialog group={editingGroup} onClose={() => setEditingGroup(null)} />}

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
      <ConfirmDialog
        open={deletingGroup != null}
        title="Delete Group"
        message={`Delete "${deletingGroup?.name}"? Its habits move back to the main list; no habits or history are deleted.`}
        confirmLabel="Delete group"
        onCancel={() => setDeletingGroup(null)}
        onConfirm={async () => {
          if (deletingGroup?.id != null) await deleteHabitGroup(deletingGroup.id)
          setDeletingGroup(null)
        }}
      />
    </>
  )
}

function HabitGroupCard({
  group,
  habits,
  totalHabits,
  emptyText,
  collapsed,
  onToggleCollapse,
  todayKey,
  dragKind,
  dragging,
  dropPos,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onEditGroup,
  onDeleteGroup,
  children,
}: {
  group: HabitGroup
  habits: Habit[]
  /** every habit in the group, regardless of the active filter/search */
  totalHabits: number
  emptyText: string
  collapsed: boolean
  onToggleCollapse: () => void
  todayKey: string
  dragKind: 'habit' | 'group' | null
  dragging: boolean
  dropPos: DropPos | 'inside' | null
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (pos: DropPos | 'inside') => void
  onDrop: (pos: DropPos | 'inside') => void
  onEditGroup: () => void
  onDeleteGroup: () => void
  children: ReactNode
}) {
  const done = habits.filter((h) => h.completionHistory[todayKey] === true).length

  const dropPosition = (event: React.DragEvent<HTMLDivElement>): DropPos | 'inside' => {
    if (dragKind === 'habit') return 'inside'
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientY < rect.top + rect.height / 2 ? 'above' : 'below'
  }

  return (
    <div
      className={`card habit-group ${dragging ? 'dragging' : ''} ${dropPos ? `drop-${dropPos}` : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        onDragOver(dropPosition(e))
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDrop(dropPosition(e))
      }}
    >
      <div
        className="habit-group-head"
        draggable
        onDragStart={(e) => {
          e.stopPropagation()
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', `group:${group.id}`)
          onDragStart()
        }}
        onDragEnd={onDragEnd}
      >
        <span className="drag-handle" title="Drag to reorder group" aria-hidden>
          <GripVertical size={16} />
        </span>
        <button
          className="grow habit-group-toggle"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${group.name}`}
        >
          <span className="habit-group-name bold">
            <span className="habit-group-chevron">
              {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            </span>
            <span className="wrap-anywhere">{group.name}</span>
          </span>
          <span className="tiny muted">
            {habits.length < totalHabits ? `${habits.length} of ${totalHabits}` : totalHabits}{' '}
            {totalHabits === 1 ? 'habit' : 'habits'} · {done} done today
          </span>
        </button>
        <div className="icon-actions">
          <button className="icon-btn" aria-label="Rename group" onClick={onEditGroup}>
            <Pencil size={17} />
          </button>
          <button className="icon-btn" aria-label="Delete group" onClick={onDeleteGroup}>
            <Trash2 size={17} color="var(--error)" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="habit-group-body">
          {habits.length === 0 ? (
            <div className="habit-group-empty">
              {totalHabits === 0 ? 'Drag habits here to add them to this group' : emptyText}
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
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
  dragging,
  dropPos,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  habit: Habit
  todayKey: string
  onOpen: () => void
  onEdit: () => void
  onArchive: () => void
  onUnarchive: () => void
  onDelete: () => void
  dragging: boolean
  dropPos: DropPos | null
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (pos: DropPos) => void
  onDrop: (pos: DropPos) => void
}) {
  const [busy, setBusy] = useState(false)
  const isCompleted = habit.completionHistory[todayKey] === true
  const isLate = habit.lateCompletions.includes(todayKey)
  const isSkipped = habit.skippedDates?.[todayKey] === true
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
    <div
      className={`card habit-card ${dragging ? 'dragging' : ''} ${dropPos ? `drop-${dropPos}` : ''}`}
      draggable
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', `habit:${habit.id}`)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        const rect = e.currentTarget.getBoundingClientRect()
        onDragOver(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below')
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        // Recompute from the drop event so a quick release can't use a stale
        // hover position.
        const rect = e.currentTarget.getBoundingClientRect()
        onDrop(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below')
      }}
    >
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <span className="drag-handle" title="Drag to reorder" aria-hidden>
          <GripVertical size={16} />
        </span>
        <button
          className="grow"
          style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer', color: 'inherit', minWidth: 0 }}
          onClick={onOpen}
        >
          <div className="bold wrap-anywhere">{habit.name}</div>
          {habit.description && <div className="small muted truncate">{stripMarkdownForSnippet(habit.description)}</div>}
          <div className="tiny muted" style={{ marginTop: 2 }}>
            {habitFrequencyLabel(habit)}
            {habit.deadlineHour != null && habit.deadlineMinute != null
              ? ` · Deadline ${String(habit.deadlineHour).padStart(2, '0')}:${String(habit.deadlineMinute).padStart(2, '0')}`
              : ''}
          </div>
          <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
            {isLate && <span className="badge medium">Late ✓</span>}
            {isSkipped && <span className="badge medium">Skipped ↷</span>}
            {!isLate && missed && <span className="badge high">✗ {missed === todayKey ? 'Today' : formatDateKey(missed, true)}</span>}
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
              className={`status-dot ${isCompleted ? (isLate ? 'late' : 'done') : isSkipped ? 'skipped' : 'warning'}`}
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

function GroupDialog({ group, onClose }: { group?: HabitGroup; onClose: () => void }) {
  const [name, setName] = useState(group?.name ?? '')
  const valid = name.trim() !== ''

  const save = async () => {
    if (!valid) return
    if (group?.id != null) await renameHabitGroup(group.id, name)
    else await createHabitGroup(name)
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={group ? 'Rename Group' : 'New Group'}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!valid}>
            {group ? 'Save' : 'Create'}
          </button>
        </div>
      }
    >
      <div className="stack">
        <Field label="Group name *">
          <TextInput
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning routine"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
            }}
          />
        </Field>
        <p className="tiny muted">
          Drag habits onto the group in the list to add them. Groups and habits can be reordered freely.
        </p>
      </div>
    </Dialog>
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
  const [groupId, setGroupId] = useState<number | null>(habit?.groupId ?? null)

  const groups = useLiveQuery(async () => db.habitGroups.toArray(), [], [])

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
      groupId,
    }
    if (habit?.id != null) {
      const next = { ...habit, ...payload } as Habit
      await db.habits.update(habit.id, {
        ...payload,
        currentStreak: computeStreak(next),
        bestStreak: Math.max(habit.bestStreak, computeBestStreak(next)),
      })
      if (groupId !== (habit.groupId ?? null)) {
        if (groupId != null) await moveHabitToGroup(habit.id, groupId)
        else await moveTopLevelItem({ kind: 'habit', id: habit.id }, null)
      }
    } else {
      const now = Date.now()
      const existing = await db.habits.toArray()
      const maxOrder = existing.reduce((max, h) => Math.max(max, h.sortOrder ?? 0), 0)
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
        skippedDates: {},
        reminderTime: null,
        isArchived: false,
        archivedAt: null,
        isDeleted: false,
        deletedAt: null,
        deadlineHour: payload.deadlineHour ?? null,
        deadlineMinute: payload.deadlineMinute ?? null,
        dailyNotes: {},
        sortOrder: maxOrder + 10,
        groupId,
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
          <TextArea
            value={description}
            onValueChange={setDescription}
            placeholder="Optional"
            size="sm"
            autoGrow={false}
          />
        </Field>
        <Field label="Frequency">
          <Select value={frequency} onChange={(e) => setFrequency(e.target.value as HabitFrequency)}>
            {HABIT_FREQUENCIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </Select>
        </Field>

        {(groups ?? []).length > 0 && (
          <Field label="Group">
            <Select
              value={groupId ?? ''}
              onChange={(e) => setGroupId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">No group</option>
              {(groups ?? []).map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </Field>
        )}

        {frequency === 'Alternate' && (
          <Field label="Skip days between (1 = every other day) *">
            <TextInput type="number" inputMode="numeric" min={1} value={alternateDays} onChange={(e) => setAlternateDays(e.target.value)} />
          </Field>
        )}

        {frequency === 'Custom' && (
          <FieldGroup label="Days *">
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
          </FieldGroup>
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
