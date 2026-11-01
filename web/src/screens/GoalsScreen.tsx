import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Flag, Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import type { Goal, GoalType } from '../db/types'
import {
  Checkbox,
  ChipRow,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  ProgressBar,
  TextArea,
  TextInput,
} from '../components/ui'

const TABS = ['Active', 'Completed'] as const
const TYPES: GoalType[] = ['Short-term', 'Long-term']

export default function GoalsScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Active')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)

  const goals = useLiveQuery(() => db.goals.toArray(), [], [])

  const visible = (goals ?? [])
    .filter((g) => (tab === 'Active' ? !g.isCompleted : g.isCompleted))
    .sort((a, b) =>
      tab === 'Active'
        ? (a.targetDate ?? Number.MAX_SAFE_INTEGER) - (b.targetDate ?? Number.MAX_SAFE_INTEGER)
        : b.createdAt - a.createdAt,
    )

  const toggleMilestone = (goal: Goal, milestone: string, done: boolean) => {
    const completedMilestones = done
      ? [...goal.completedMilestones, milestone]
      : goal.completedMilestones.filter((m) => m !== milestone)
    const progress =
      goal.milestones.length > 0 ? completedMilestones.length / goal.milestones.length : goal.progress
    void db.goals.put({
      ...goal,
      completedMilestones,
      progress,
      isCompleted: progress >= 1,
    })
  }

  return (
    <>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Goals</h1>
          <p className="page-sub">Set targets and track progress</p>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <ChipRow options={TABS} value={tab} onChange={setTab} />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Flag size={40} />}
          title={tab === 'Active' ? 'No goals yet' : 'No completed goals'}
          subtitle={tab === 'Active' ? 'Tap + to set your first goal' : 'Goals you finish will appear here'}
        />
      ) : (
        <div className="stack">
          {visible.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => setEditing(goal)}
              onToggleMilestone={(m, done) => toggleMilestone(goal, m, done)}
            />
          ))}
        </div>
      )}

      <button className="fab" aria-label="Add goal" onClick={() => setShowAdd(true)}>
        <Plus size={26} />
      </button>

      {showAdd && <GoalDialog onClose={() => setShowAdd(false)} />}
      {editing && <GoalDialog key={editing.id} goal={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function GoalCard({
  goal,
  onEdit,
  onToggleMilestone,
}: {
  goal: Goal
  onEdit: () => void
  onToggleMilestone: (milestone: string, done: boolean) => void
}) {
  const [showMilestones, setShowMilestones] = useState(false)
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="card">
      <div className="row-between">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="bold">{goal.title}</div>
          <div className="row" style={{ gap: 8, marginTop: 2 }}>
            <span className="badge soft">{goal.type}</span>
            {goal.isCompleted && <span className="badge low">Completed</span>}
          </div>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn" style={{ width: 34, height: 34 }} aria-label="Edit goal" onClick={onEdit}>
            <Pencil size={16} />
          </button>
          <button className="icon-btn" style={{ width: 34, height: 34 }} aria-label="Delete goal" onClick={() => setConfirm(true)}>
            <Trash2 size={16} color="var(--error)" />
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <ProgressBar value={goal.progress} color={goal.isCompleted ? 'var(--success)' : undefined} />
        <div className="row-between" style={{ marginTop: 4 }}>
          <span className="tiny muted">{Math.round(goal.progress * 100)}% complete</span>
          {goal.targetDate && (
            <span className="tiny muted">
              by {new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {goal.description && (
        <p className="small muted" style={{ marginTop: 8 }}>
          {goal.description}
        </p>
      )}

      {goal.milestones.length > 0 && (
        <>
          <button
            className="btn btn-sm btn-outline"
            style={{ marginTop: 12 }}
            onClick={() => setShowMilestones((v) => !v)}
          >
            {showMilestones ? 'Hide' : 'Show'} milestones ({goal.completedMilestones.length}/{goal.milestones.length})
          </button>

          {showMilestones && (
            <div style={{ marginTop: 8 }}>
              {goal.milestones.map((m, i) => {
                const done = goal.completedMilestones.includes(m)
                return (
                  <div key={`${m}-${i}`} className="row" style={{ padding: '3px 0' }}>
                    <Checkbox checked={done} onChange={(next) => onToggleMilestone(m, next)} label={`Toggle ${m}`} />
                    <span className={`small grow ${done ? 'strike' : ''}`}>{m}</span>
                    {done && <Check size={14} color="var(--success)" />}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirm}
        title="Delete Goal"
        message={`Are you sure you want to delete "${goal.title}"?`}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          if (goal.id != null) void db.goals.delete(goal.id)
          setConfirm(false)
        }}
      />
    </div>
  )
}

function GoalDialog({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const editing = goal != null
  const [title, setTitle] = useState(goal?.title ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [type, setType] = useState<GoalType>(goal?.type ?? 'Short-term')
  const [milestonesText, setMilestonesText] = useState(goal?.milestones.join('\n') ?? '')
  const [progress, setProgress] = useState(goal?.progress ?? 0)

  const save = () => {
    if (!title.trim()) return
    const milestones = milestonesText
      .split('\n')
      .map((m) => m.trim())
      .filter(Boolean)
    if (editing && goal) {
      void db.goals.put({
        ...goal,
        title: title.trim(),
        description: description.trim(),
        type,
        progress,
        milestones,
        completedMilestones: goal.completedMilestones.filter((m) => milestones.includes(m)),
      })
    } else {
      void db.goals.add({
        title: title.trim(),
        description: description.trim(),
        type,
        progress: 0,
        targetDate: null,
        milestones,
        completedMilestones: [],
        isCompleted: false,
        createdAt: Date.now(),
      })
    }
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? 'Edit Goal' : 'Add Goal'}
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
        <Field label="Goal *">
          <TextInput autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Read 12 books" />
        </Field>
        <Field label="Description">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 80 }} />
        </Field>
        <Field label="Type">
          <div className="row">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip ${type === t ? 'active' : ''}`}
                onClick={() => setType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Milestones (one per line)">
          <TextArea
            value={milestonesText}
            onChange={(e) => setMilestonesText(e.target.value)}
            placeholder={'First milestone\nSecond milestone'}
            style={{ minHeight: 90 }}
          />
        </Field>
        {editing && (
          <Field label={`Progress: ${Math.round(progress * 100)}%`}>
            <input
              className="slider"
              type="range"
              min={0}
              max={100}
              value={Math.round(progress * 100)}
              onChange={(e) => setProgress(Number(e.target.value) / 100)}
            />
          </Field>
        )}
      </div>
    </Dialog>
  )
}
