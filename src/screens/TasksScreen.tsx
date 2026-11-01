import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { db } from '../db/db'
import { deleteTaskCascade, newTask, toggleTaskCompletion } from '../db/tasks'
import type { Priority, RecurringType, Task } from '../db/types'
import { endOfDay, fromDateInput, startOfDay, toDateInput, formatDate } from '../lib/dates'
import {
  Checkbox,
  ChipRow,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Select,
  TextArea,
  TextInput,
  priorityClass,
} from '../components/ui'

const FILTERS = ['All', 'Today', 'Upcoming', 'Overdue', 'Done'] as const
type Filter = (typeof FILTERS)[number]

export default function TasksScreen() {
  const [filter, setFilter] = useState<Filter>('All')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [deletingSubtask, setDeletingSubtask] = useState<{ id: number; title: string } | null>(null)

  const tasks = useLiveQuery(() => db.tasks.toArray(), [], [])
  const subtasks = useLiveQuery(() => db.subtasks.toArray(), [], [])

  const subtasksByTask = useMemo(() => {
    const map = new Map<number, typeof subtasks>()
    for (const s of subtasks) {
      const list = map.get(s.taskId) ?? []
      list.push(s)
      map.set(s.taskId, list)
    }
    return map
  }, [subtasks])

  const visible = useMemo(() => {
    const todayStart = startOfDay()
    const filtered = (tasks ?? []).filter((t) => {
      switch (filter) {
        case 'Today':
          return t.dueDate != null && t.dueDate >= todayStart && t.dueDate <= endOfDay() && !t.isCompleted
        case 'Upcoming':
          return t.dueDate != null && startOfDay(t.dueDate) > todayStart && !t.isCompleted
        case 'Overdue':
          return t.dueDate != null && endOfDay(t.dueDate) < todayStart && !t.isCompleted
        case 'Done':
          return t.isCompleted
        default:
          return true
      }
    })
    const q = query.trim().toLowerCase()
    const searched = q
      ? filtered.filter(
          (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
        )
      : filtered
    return [...searched].sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))
  }, [tasks, filter, query])

  const onToggle = (task: Task, next: boolean) => {
    if (task.id == null) return
    void toggleTaskCompletion(task.id, next)
  }

  return (
    <>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-sub">
            {visible.length} {visible.length === 1 ? 'task' : 'tasks'}
          </p>
        </div>
        <button
          className="icon-btn"
          aria-label="Search"
          onClick={() => {
            setSearchOpen((v) => !v)
            if (searchOpen) setQuery('')
          }}
        >
          {searchOpen ? <X size={20} /> : <Search size={20} />}
        </button>
      </div>

      {searchOpen && (
        <div className="search" style={{ marginBottom: 12 }}>
          <Search size={18} />
          <input
            className="input"
            autoFocus
            placeholder="Search tasks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <ChipRow options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<ChevronDown size={40} />}
          title="No tasks yet"
          subtitle="Tap + to add your first task"
        />
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {visible.map((task) => {
            const list = task.id != null ? subtasksByTask.get(task.id) ?? [] : []
            const isOpen = task.id != null && expanded === task.id
            const done = list.filter((s) => s.isCompleted).length

            return (
              <div key={task.id} className="card" style={{ padding: 14 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <Checkbox
                    checked={task.isCompleted}
                    onChange={(next) => onToggle(task, next)}
                    label={`Mark ${task.title} complete`}
                  />

                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className={task.isCompleted ? 'strike' : ''} style={{ fontWeight: 500 }}>
                      {task.title}
                    </div>
                    <div className="row wrap tiny muted" style={{ gap: 8, marginTop: 2 }}>
                      {task.category && <span>{task.category}</span>}
                      {task.dueDate != null && <span>• {formatDate(task.dueDate)}</span>}
                      {task.isRecurring && task.recurringType && (
                        <span className="badge soft">{task.recurringType}</span>
                      )}
                    </div>
                    {task.description && (
                      <div className="small muted" style={{ marginTop: 4 }}>
                        {task.description}
                      </div>
                    )}
                  </div>

                  <span className={`badge ${priorityClass(task.priority)}`}>{task.priority}</span>

                  <button className="icon-btn" aria-label="Edit" onClick={() => setEditing(task)}>
                    <Pencil size={17} />
                  </button>
                  <DeleteButton task={task} />
                </div>

                <div style={{ marginTop: 10, paddingLeft: 34 }}>
                  <div className="row-between">
                    <span className="tiny muted">
                      Subtasks ({done}/{list.length})
                    </span>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() =>
                        setExpanded((cur) => (task.id != null && cur === task.id ? null : task.id ?? null))
                      }
                    >
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {isOpen ? 'Collapse' : list.length === 0 ? 'Add subtask' : 'Expand'}
                    </button>
                  </div>

                  {isOpen && (
                    <div style={{ marginTop: 8 }}>
                      {list.map((s) => (
                        <div key={s.id} className="row" style={{ padding: '3px 0' }}>
                          <Checkbox
                            checked={s.isCompleted}
                            onChange={(next) => s.id != null && db.subtasks.update(s.id, { isCompleted: next })}
                            label={`Mark ${s.title} complete`}
                          />
                          <span className={`small grow ${s.isCompleted ? 'strike' : ''}`}>{s.title}</span>
                          <button
                            className="icon-btn"
                            style={{ width: 30, height: 30 }}
                            aria-label="Delete subtask"
                            onClick={() => s.id != null && setDeletingSubtask({ id: s.id, title: s.title })}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <SubtaskAdder taskId={task.id!} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button className="fab" aria-label="Add task" onClick={() => setShowAdd(true)}>
        <Plus size={26} />
      </button>

      {showAdd && (
        <TaskDialog
          onClose={() => setShowAdd(false)}
          onSave={async (t) => {
            await db.tasks.add(t)
            setShowAdd(false)
          }}
        />
      )}

      {editing && (
        <TaskDialog
          key={editing.id}
          task={editing}
          onClose={() => setEditing(null)}
          onSave={async (t) => {
            if (t.id != null) await db.tasks.put(t)
            setEditing(null)
          }}
        />
      )}

      <ConfirmDialog
        open={deletingSubtask != null}
        title="Delete Subtask"
        message={`Delete "${deletingSubtask?.title}"?`}
        onCancel={() => setDeletingSubtask(null)}
        onConfirm={() => {
          if (deletingSubtask) void db.subtasks.delete(deletingSubtask.id)
          setDeletingSubtask(null)
        }}
      />
    </>
  )
}

function DeleteButton({ task }: { task: Task }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="icon-btn" aria-label="Delete" onClick={() => setOpen(true)}>
        <Trash2 size={17} color="var(--error)" />
      </button>
      <ConfirmDialog
        open={open}
        title="Delete Task"
        message={`Are you sure you want to delete "${task.title}"?`}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          void deleteTaskCascade(task)
          setOpen(false)
        }}
      />
    </>
  )
}

function SubtaskAdder({ taskId }: { taskId: number }) {
  const [title, setTitle] = useState('')
  const add = async () => {
    if (!title.trim()) return
    await db.subtasks.add({
      taskId,
      title: title.trim(),
      isCompleted: false,
      createdAt: Date.now(),
    })
    setTitle('')
  }
  return (
    <form
      className="row"
      style={{ marginTop: 6 }}
      onSubmit={(e) => {
        e.preventDefault()
        void add()
      }}
    >
      <TextInput
        placeholder="Add subtask"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ padding: '7px 11px' }}
      />
      <button className="btn btn-sm btn-outline" type="submit" disabled={!title.trim()}>
        <Plus size={14} />
      </button>
    </form>
  )
}

export function TaskDialog({
  task,
  onClose,
  onSave,
}: {
  task?: Task | null
  onClose: () => void
  onSave: (task: Task) => void | Promise<void>
}) {
  const editing = task != null
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'Medium')
  const [category, setCategory] = useState(task?.category ?? '')
  const [dueDate, setDueDate] = useState(toDateInput(task?.dueDate ?? null))
  const [isRecurring, setIsRecurring] = useState(task?.isRecurring ?? false)
  const [recurringType, setRecurringType] = useState<RecurringType>(task?.recurringType ?? 'Daily')

  const submit = () => {
    if (!title.trim()) return
    const base = editing && task ? { ...task } : newTask({ title: title.trim() })
    void onSave({
      ...base,
      title: title.trim(),
      description: description.trim(),
      priority,
      category: category.trim(),
      dueDate: fromDateInput(dueDate),
      isRecurring,
      recurringType: isRecurring ? recurringType : null,
      updatedAt: Date.now(),
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? 'Edit Task' : 'Add Task'}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!title.trim()}>
            {editing ? 'Save' : 'Add'}
          </button>
        </div>
      }
    >
      <div className="stack">
        <Field label="Title *">
          <TextInput autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" />
        </Field>
        <Field label="Description">
          <TextArea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details"
            style={{ minHeight: 80 }}
          />
        </Field>
        <div className="grid-2">
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </Select>
          </Field>
          <Field label="Category">
            <TextInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Work" />
          </Field>
        </div>
        <Field label="Due date">
          <div className="row">
            <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            {dueDate && (
              <button className="btn btn-sm btn-outline" onClick={() => setDueDate('')}>
                Clear
              </button>
            )}
          </div>
        </Field>
        <div className="row-between">
          <span className="label" style={{ margin: 0 }}>
            Recurring task
          </span>
          <button
            type="button"
            className={`switch ${isRecurring ? 'on' : ''}`}
            aria-label="Toggle recurring"
            aria-pressed={isRecurring}
            onClick={() => setIsRecurring((v) => !v)}
          />
        </div>
        {isRecurring && (
          <Field label="Repeat">
            <Select value={recurringType} onChange={(e) => setRecurringType(e.target.value as RecurringType)}>
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
            </Select>
          </Field>
        )}
      </div>
    </Dialog>
  )
}
