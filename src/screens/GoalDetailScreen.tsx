import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import type { Goal, GoalMilestone } from '../db/types'
import {
  GOAL_STATUSES,
  allMilestonesDone,
  goalProgress,
  goalStatus,
  milestonesDone,
  setGoalStatus,
  setMilestoneNote,
  toggleGoalMilestone,
} from '../db/goals'
import {
  Checkbox,
  ConfirmDialog,
  IconButton,
  PageHeader,
  ProgressRing,
  TextArea,
} from '../components/ui'
import { formatDate } from '../lib/dates'
import { stripMarkdownForSnippet } from '../lib/markdown'
import { GoalDialog } from './GoalsScreen'

function formatDay(ts: number): string {
  return formatDate(ts)
}

export default function GoalDetailScreen() {
  const { goalId } = useParams()
  const navigate = useNavigate()
  const id = Number(goalId)
  const goal = useLiveQuery(async () => (id ? ((await db.goals.get(id)) ?? null) : null), [id])

  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (goal === undefined) return <div className="empty">Loading…</div>

  if (goal === null) {
    return (
      <div className="empty">
        <div className="bold" style={{ color: 'var(--text)', fontSize: 20 }}>Goal not found</div>
        <button className="btn btn-primary" onClick={() => navigate('/goals')}>Back to goals</button>
      </div>
    )
  }

  const status = goalStatus(goal)
  const progress = goalProgress(goal)
  const done = milestonesDone(goal)
  const total = goal.milestones.length
  const canComplete = allMilestonesDone(goal)

  return (
    <>
      <PageHeader
        title={goal.title}
        subtitle={goal.description ? stripMarkdownForSnippet(goal.description) : undefined}
        wrapTitle
        onBack={() => navigate('/goals')}
        actions={
          <div className="row" style={{ gap: 0 }}>
            <IconButton label="Edit goal" onClick={() => setEditing(true)}>
              <Pencil size={20} />
            </IconButton>
            <IconButton label="Delete goal" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={20} color="var(--error)" />
            </IconButton>
          </div>
        }
      />

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        <ProgressRing value={progress} size={104} stroke={9} label="Goal progress">
          <span className="ring-value" style={{ fontSize: 20 }}>
            {done}/{total}
          </span>
          <span className="ring-caption">milestones</span>
        </ProgressRing>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <span
              className={`badge ${
                status === 'Completed' ? 'low' : status === 'On Hold' ? 'medium' : 'primary'
              }`}
            >
              {status}
            </span>
            {status === 'Completed' && goal.completedAt && (
              <span className="tiny muted">Completed on {formatDay(goal.completedAt)}</span>
            )}
          </div>
          <div className="tiny muted" style={{ marginTop: 6 }}>
            {Math.round(progress * 100)}% complete
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label" style={{ marginBottom: 8 }}>Status</div>
        <div className="row wrap">
          {GOAL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${status === s ? 'active' : ''}`}
              disabled={s === 'Completed' && !canComplete}
              onClick={() => void setGoalStatus(goal, s)}
            >
              {s}
            </button>
          ))}
        </div>
        {total === 0 ? (
          <div className="tiny muted" style={{ marginTop: 8 }}>
            Add milestones to track progress and complete this goal.
          </div>
        ) : (
          !canComplete && (
            <div className="tiny muted" style={{ marginTop: 8 }}>
              Check off every milestone to mark this goal Completed.
            </div>
          )
        )}
      </div>

      <div className="row-between" style={{ marginBottom: 8 }}>
        <span className="section-label">
          Milestones ({done}/{total})
        </span>
      </div>

      {total === 0 ? (
        <div className="card">
          <p className="small muted">No milestones yet. Edit the goal to add some.</p>
        </div>
      ) : (
        <div className="stack">
          {goal.milestones.map((milestone) => (
            <MilestoneCard key={milestone.id} goal={goal} milestone={milestone} />
          ))}
        </div>
      )}

      {editing && <GoalDialog goal={goal} onClose={() => setEditing(false)} />}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Goal"
        message={`Are you sure you want to delete "${goal.title}"?`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (goal.id != null) void db.goals.delete(goal.id)
          setConfirmDelete(false)
          navigate('/goals')
        }}
      />
    </>
  )
}

function MilestoneCard({ goal, milestone }: { goal: Goal; milestone: GoalMilestone }) {
  const done = milestone.completedAt != null
  const completedAt = milestone.completedAt
  const note = milestone.note
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(note)

  // A save shows up through the live query; keep the textarea in step unless
  // the user is mid-edit (their draft is preserved until blur).
  useEffect(() => {
    setDraft(note)
  }, [note])

  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
        <Checkbox
          checked={done}
          onChange={(next) => void toggleGoalMilestone(goal, milestone.id, next)}
          label={`Toggle ${milestone.text}`}
        />
        <div className="grow" style={{ minWidth: 0 }}>
          <button
            type="button"
            className="milestone-title"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={`grow ${done ? 'strike' : ''}`}>{milestone.text}</span>
            <ChevronDown size={16} className={`chevron ${open ? 'open' : ''}`} />
          </button>

          {done && (
            <div className="tiny muted" style={{ marginTop: 2 }}>
              {completedAt ? `Completed on ${formatDay(completedAt)}` : 'Completed'}
            </div>
          )}

          {open && (
            <div style={{ marginTop: 10 }}>
              <TextArea
                value={draft}
                onValueChange={setDraft}
                onBlur={() => {
                  if (draft !== note) void setMilestoneNote(goal, milestone.id, draft)
                }}
                placeholder="Write something about this milestone…"
                size="sm"
                autoGrow={false}
                preview="below"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
