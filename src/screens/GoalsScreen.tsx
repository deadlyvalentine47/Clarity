import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Flag, Plus, X } from 'lucide-react'
import { db } from '../db/db'
import type { Goal, GoalMilestone, GoalStatus } from '../db/types'
import {
  GOAL_STATUSES,
  goalProgress,
  goalStatus,
  milestonesDone,
  withDerived,
} from '../db/goals'
import { newMilestoneId } from '../db/goalMilestones'
import {
  ChipRow,
  Dialog,
  EmptyState,
  ListSkeleton,
  Field,
  FieldGroup,
  ProgressBar,
  TextArea,
  TextInput,
} from '../components/ui'

const TABS = ['Active', 'Completed'] as const

export default function GoalsScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Active')
  const [showAdd, setShowAdd] = useState(false)
  const navigate = useNavigate()

  const goals = useLiveQuery(() => db.goals.toArray(), [])

  const visible = (goals ?? [])
    .filter((g) => (tab === 'Active' ? goalStatus(g) !== 'Completed' : goalStatus(g) === 'Completed'))
    .sort((a, b) =>
      tab === 'Active'
        ? (a.targetDate ?? Number.MAX_SAFE_INTEGER) - (b.targetDate ?? Number.MAX_SAFE_INTEGER)
        : b.createdAt - a.createdAt,
    )

  if (goals === undefined) return <ListSkeleton rows={3} />

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
            <GoalCard key={goal.id} goal={goal} onOpen={() => navigate(`/goals/${goal.id}`)} />
          ))}
        </div>
      )}

      <button className="fab" aria-label="Add goal" onClick={() => setShowAdd(true)}>
        <Plus size={26} />
      </button>

      {showAdd && <GoalDialog onClose={() => setShowAdd(false)} />}
    </>
  )
}

function GoalCard({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  const status = goalStatus(goal)
  const progress = goalProgress(goal)
  const done = milestonesDone(goal)

  return (
    <div
      className="card clickable"
      role="button"
      tabIndex={0}
      aria-label={`Open ${goal.title}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="bold truncate">{goal.title}</div>
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <span
              className={`badge ${
                status === 'Completed' ? 'low' : status === 'On Hold' ? 'medium' : 'primary'
              }`}
            >
              {status}
            </span>
            {goal.milestones.length > 0 && (
              <span className="tiny muted">
                {done}/{goal.milestones.length} milestones
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={18} className="muted" />
      </div>

      <div style={{ marginTop: 12 }}>
        <ProgressBar value={progress} color={status === 'Completed' ? 'var(--success)' : undefined} />
        <div className="row-between" style={{ marginTop: 4 }}>
          <span className="tiny muted">{Math.round(progress * 100)}% complete</span>
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
    </div>
  )
}

export function GoalDialog({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const editing = goal != null
  const [title, setTitle] = useState(goal?.title ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [status, setStatus] = useState<GoalStatus>(goal ? goalStatus(goal) : 'In Progress')
  const [milestones, setMilestones] = useState<GoalMilestone[]>(goal?.milestones ?? [])

  const nextMilestones = milestones
    .filter((m) => m.text.trim())
    .map((m) => ({ ...m, text: m.text.trim() }))
  const completedLocked = !(
    nextMilestones.length > 0 && nextMilestones.every((m) => m.completedAt != null)
  )

  const updateMilestone = (index: number, value: string) =>
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, text: value } : m)))

  const addMilestone = (after?: number) =>
    setMilestones((prev) => {
      const next = [...prev]
      next.splice(after == null ? next.length : after + 1, 0, {
        id: newMilestoneId(),
        text: '',
        note: '',
        completedAt: null,
      })
      return next
    })

  const removeMilestone = (index: number) =>
    setMilestones((prev) => prev.filter((_, i) => i !== index))

  const save = () => {
    if (!title.trim()) return

    if (editing && goal) {
      // A Completed goal must still have every milestone checked.
      const allDone =
        nextMilestones.length > 0 && nextMilestones.every((m) => m.completedAt != null)
      const nextStatus: GoalStatus = status === 'Completed' && !allDone ? 'In Progress' : status
      void db.goals.put(
        withDerived({
          ...goal,
          title: title.trim(),
          description: description.trim(),
          status: nextStatus,
          milestones: nextMilestones,
          completedAt: nextStatus === 'Completed' ? goal.completedAt ?? null : null,
        }),
      )
    } else {
      void db.goals.add(
        withDerived({
          title: title.trim(),
          description: description.trim(),
          // A brand-new goal has nothing checked yet, so it can't be Completed.
          status: status === 'Completed' ? 'In Progress' : status,
          type: 'Short-term',
          progress: 0,
          targetDate: null,
          milestones: nextMilestones,
          isCompleted: false,
          completedAt: null,
          createdAt: Date.now(),
        }),
      )
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
        <FieldGroup
          label="Status"
          hint={
            completedLocked
              ? 'Completed unlocks once every milestone is checked off'
              : undefined
          }
        >
          <div className="row wrap">
            {GOAL_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip ${status === s ? 'active' : ''}`}
                disabled={s === 'Completed' && completedLocked}
                onClick={() => setStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </FieldGroup>
        <FieldGroup label="Milestones">
          <div className="stack" style={{ gap: 8 }}>
            {milestones.length === 0 && <span className="tiny muted">No milestones yet.</span>}
            {milestones.map((milestone, index) => (
              <div key={milestone.id} className="row" style={{ gap: 6 }}>
                <div className="grow">
                  <TextInput
                    value={milestone.text}
                    placeholder={`Milestone ${index + 1}`}
                    aria-label={`Milestone ${index + 1}`}
                    onChange={(e) => updateMilestone(index, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addMilestone(index)
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove milestone ${index + 1}`}
                  onClick={() => removeMilestone(index)}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => addMilestone()}>
                <Plus size={15} /> Add milestone
              </button>
            </div>
          </div>
        </FieldGroup>
      </div>
    </Dialog>
  )
}
