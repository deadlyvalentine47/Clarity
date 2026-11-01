import { useEffect, useState, useSyncExternalStore } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BellRing, Pause, Play, Plus, RotateCcw, Timer } from 'lucide-react'
import {
  dismissAlarm,
  getState,
  loadSession,
  logDistraction,
  pauseTimer,
  resetTimer,
  setBreakDuration,
  setFocusDuration,
  startTimer,
  subscribe,
} from '../lib/pomodoroStore'
import { Dialog, Field, TextInput } from '../components/ui'

export default function PomodoroScreen() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const state = useSyncExternalStore(subscribe, getState, getState)
  const [showDistraction, setShowDistraction] = useState(false)

  useEffect(() => {
    void loadSession(Number(sessionId))
  }, [sessionId])

  const totalSeconds = (state.isBreak ? state.breakDurationMinutes : state.focusDurationMinutes) * 60
  const progress = totalSeconds > 0 ? (totalSeconds - state.timeLeftSeconds) / totalSeconds : 0
  const minutes = Math.floor(state.timeLeftSeconds / 60)
  const seconds = state.timeLeftSeconds % 60

  const R = 88
  const C = 2 * Math.PI * R
  const accent = state.isBreak ? 'var(--secondary)' : 'var(--primary)'

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="icon-btn" aria-label="Back" onClick={() => navigate('/pomodoro')}>
          <ArrowLeft size={22} />
        </button>
        <div className="grow" style={{ minWidth: 0 }}>
          <h1 className="page-title truncate" style={{ fontSize: 20 }}>
            {state.title || 'Pomodoro'}
          </h1>
          <p className="page-sub" style={{ color: accent, fontWeight: 600 }}>
            {state.isBreak ? 'Break Time' : 'Focus Time'}
          </p>
        </div>
      </div>

      {state.isAlarmPlaying && (
        <div
          className="card"
          style={{
            background: 'var(--error-container)',
            color: 'var(--error)',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <BellRing size={20} />
          <span className="grow bold">{state.isBreak ? 'Focus session complete!' : 'Break over!'}</span>
          <button className="btn btn-sm btn-danger" onClick={dismissAlarm}>
            Dismiss
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 20px' }}>
        <div style={{ position: 'relative', width: 220, height: 220 }}>
          <svg width="220" height="220" viewBox="0 0 220 220" className="timer-ring" aria-hidden>
            <circle cx="110" cy="110" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="12" />
            <circle
              cx="110"
              cy="110"
              r={R}
              fill="none"
              stroke={accent}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - Math.min(1, Math.max(0, progress)))}
              transform="rotate(-90 110 110)"
              style={{ transition: 'stroke-dashoffset 0.3s linear' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div className="timer-text">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
            <div className="tiny muted">Pomodoro #{state.sessionCount + 1}</div>
          </div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 14, marginBottom: 20 }}>
        {state.isAlarmPlaying ? (
          <button className="btn btn-danger" style={{ padding: '14px 28px' }} onClick={dismissAlarm}>
            <Pause size={18} /> Dismiss alarm
          </button>
        ) : state.isRunning ? (
          <button className="btn btn-danger" style={{ padding: '14px 28px' }} onClick={pauseTimer}>
            <Pause size={18} /> Pause
          </button>
        ) : (
          <button className="btn btn-primary" style={{ padding: '14px 28px' }} onClick={startTimer}>
            <Play size={18} /> {state.isPaused ? 'Resume' : 'Start'}
          </button>
        )}
        <button className="btn btn-outline" style={{ padding: '14px 20px' }} onClick={resetTimer} aria-label="Reset timer">
          <RotateCcw size={18} /> Reset
        </button>
      </div>

      <div className="stack">
        <div className="card">
          <div className="section-label">Session</div>
          <div className="row-between" style={{ marginTop: 6 }}>
            <div>
              <div className="bold">Pomodoro #{state.sessionCount + 1}</div>
              <div className="small muted">Today&apos;s focus: {state.totalFocusMinutes}m</div>
            </div>
            <div className="badge primary">{state.sessionCount} done</div>
          </div>
        </div>

        <div className="card">
          <div className="section-label" style={{ marginBottom: 10 }}>
            Timer settings
          </div>
          <div className="grid-2">
            <Field label="Focus (min) *">
              <TextInput
                type="number"
                min={1}
                max={90}
                value={state.focusInput}
                onChange={(e) => setFocusDuration(e.target.value)}
                disabled={state.isRunning}
              />
            </Field>
            <Field label="Break (min) *">
              <TextInput
                type="number"
                min={1}
                max={30}
                value={state.breakInput}
                onChange={(e) => setBreakDuration(e.target.value)}
                disabled={state.isRunning}
              />
            </Field>
          </div>
        </div>

        <div className="card">
          <div className="row-between" style={{ marginBottom: 8 }}>
            <div className="section-label">Distraction log</div>
            <button className="icon-btn" aria-label="Log distraction" onClick={() => setShowDistraction(true)}>
              <Plus size={20} />
            </button>
          </div>
          {state.distractions.length === 0 ? (
            <p className="small muted">No distractions logged</p>
          ) : (
            <div className="stack" style={{ gap: 4, maxHeight: 180, overflowY: 'auto' }}>
              {state.distractions.map((d, i) => (
                <div key={i} className="small">
                  • {d}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showDistraction} onClose={() => setShowDistraction(false)} title="Log Distraction">
        <DistractionForm
          onLog={(text) => {
            logDistraction(text)
            setShowDistraction(false)
          }}
          onCancel={() => setShowDistraction(false)}
        />
      </Dialog>
    </>
  )
}

function DistractionForm({ onLog, onCancel }: { onLog: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState('')
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) onLog(text.trim())
      }}
    >
      <Field label="What distracted you?">
        <TextInput autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Phone notification" />
      </Field>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
          Log
        </button>
      </div>
    </form>
  )
}
