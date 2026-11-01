import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Timer, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import type { PomodoroFocusSession } from '../db/types'
import { createSession, clearActiveSession, getState } from '../lib/pomodoroStore'
import { formatDateTime } from '../lib/dates'
import { ConfirmDialog, Dialog, EmptyState, Field, TextInput } from '../components/ui'

export default function PomodoroListScreen() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const sessions = useLiveQuery(
    async () => (await db.pomodoroFocusSessions.toArray()).sort((a, b) => b.updatedAt - a.updatedAt),
    [],
    [],
  )

  const filtered = (sessions ?? []).filter((s) =>
    s.title.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="page-title">Pomodoro</h1>
          <p className="page-sub">Focus sessions and distraction logs</p>
        </div>
      </div>

      <div className="search" style={{ marginBottom: 14 }}>
        <Search size={18} />
        <input
          className="input"
          placeholder="Search sessions..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Timer size={40} />}
          title="No sessions yet"
          subtitle={query.trim() ? 'No sessions match your search' : 'Tap + to create your first session'}
        />
      ) : (
        <div className="stack">
          {filtered.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onOpen={() => navigate(`/pomodoro/${session.id}`)}
            />
          ))}
        </div>
      )}

      <button className="fab" aria-label="New session" onClick={() => setShowAdd(true)}>
        <Plus size={26} />
      </button>

      {showAdd && (
        <NewSessionDialog
          onClose={() => setShowAdd(false)}
          onCreate={async (title) => {
            const id = await createSession(title)
            setShowAdd(false)
            navigate(`/pomodoro/${id}`)
          }}
        />
      )}
    </>
  )
}

function SessionCard({ session, onOpen }: { session: PomodoroFocusSession; onOpen: () => void }) {
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="card clickable" onClick={onOpen}>
      <div className="row-between">
        <div className="bold grow truncate">{session.title}</div>
        <button
          className="btn btn-sm btn-danger"
          onClick={(e) => {
            e.stopPropagation()
            setConfirm(true)
          }}
        >
          Delete
        </button>
      </div>

      <div className="row wrap small muted" style={{ gap: 16, marginTop: 8 }}>
        <span>{session.sessionCount} sessions</span>
        <span>{session.totalFocusMinutes}m focused</span>
        <span>
          {session.focusDurationMinutes}/{session.breakDurationMinutes}m
        </span>
      </div>
      <div className="tiny muted" style={{ marginTop: 4 }}>
        {formatDateTime(session.updatedAt)}
      </div>

      <ConfirmDialog
        open={confirm}
        title="Delete Session"
        message={`Are you sure you want to delete "${session.title}"?`}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          if (session.id != null) {
            void db.pomodoroFocusSessions.delete(session.id)
            // Only reset the live timer if the deleted session is the active one.
            if (getState().focusSessionId === session.id) clearActiveSession()
          }
          setConfirm(false)
        }}
      />
    </div>
  )
}

function NewSessionDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (title: string) => void
}) {
  const [title, setTitle] = useState('')

  return (
    <Dialog
      open
      onClose={onClose}
      title="New Session"
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => onCreate(title.trim())} disabled={!title.trim()}>
            Create
          </button>
        </div>
      }
    >
      <Field label="Session title">
        <TextInput
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Deep work"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && title.trim()) onCreate(title.trim())
          }}
        />
      </Field>
    </Dialog>
  )
}
