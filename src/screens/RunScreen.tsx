import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Footprints, Pause, Play, Square } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext'
import type { DistanceUnit } from '../db/types'
import {
  formatClock,
  formatPace,
  metersPerUnit,
  metersToUnit,
} from '../lib/geo'
import { isNative, openLocationSettings } from '../lib/native'
import {
  discardRun,
  pauseRun,
  resumeRun,
  retryGps,
  saveRun,
  setGpsEnabled,
  simulateRun,
  startRun,
  startWithoutGps,
  stopRun,
  useRunState,
} from '../lib/runStore'
import { Dialog, Field, PageHeader, Segmented, TextInput } from '../components/ui'
import { RichTextEditor } from '../components/RichTextEditor'

type WakeLockSentinelLike = { release: () => Promise<void> }

function gpsLabel(state: ReturnType<typeof useRunState>): string {
  if (state.status === 'acquiring') {
    return state.gpsStatus === 'timeout' ? 'No GPS fix' : 'Acquiring GPS…'
  }
  if (state.status === 'finished' || !state.gpsEnabled) return 'GPS off'
  switch (state.gpsStatus) {
    case 'ok':
      return state.accuracy != null ? `±${Math.round(state.accuracy)} m` : 'GPS ready'
    case 'denied':
      return 'Permission denied'
    case 'unavailable':
      return 'GPS unavailable'
    case 'timeout':
      return 'No GPS fix'
    case 'searching':
      return 'Searching…'
    default:
      return state.status === 'paused' ? 'GPS paused' : 'GPS ready'
  }
}

/** A starting point for the name field; the user can always type over it. */
function suggestedName(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Morning run'
  if (hour < 17) return 'Afternoon run'
  if (hour < 21) return 'Evening run'
  return 'Night run'
}

export default function RunScreen() {
  const navigate = useNavigate()
  const { prefs, setDistanceUnit } = usePreferences()
  const unit = prefs.distanceUnit
  const state = useRunState()

  const [showSave, setShowSave] = useState(false)
  const [saveDistance, setSaveDistance] = useState('0.00')
  const [saveNotes, setSaveNotes] = useState('')
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)

  // A session may already be finished when this screen mounts (e.g. the app was
  // killed between Stop and Save); open the dialog for it.
  useEffect(() => {
    if (state.status === 'finished' && !showSave) {
      setSaveDistance(metersToUnit(state.distanceMeters, unit).toFixed(2))
      setSaveName(suggestedName())
      setSaveNotes('')
      setShowSave(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status])

  useEffect(() => {
    if (state.status !== 'running') return
    let active = true
    let sentinel: WakeLockSentinelLike | null = null
    const wakeLock = (
      navigator as unknown as {
        wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
      }
    ).wakeLock

    const request = async () => {
      if (!wakeLock) return
      try {
        const next = await wakeLock.request('screen')
        if (active) sentinel = next
        else void next.release()
      } catch {
        // Unsupported, denied, or the page is hidden — tracking still runs.
      }
    }

    void request()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => undefined)
    }
  }, [state.status])

  const distanceValue = metersToUnit(state.distanceMeters, unit).toFixed(2)
  const pace = formatPace(state.elapsedSeconds, state.distanceMeters, unit)

  const handleStart = () => {
    startRun({ gps: state.gpsEnabled })
  }

  const handleStop = () => {
    const gpsMeters = state.distanceMeters
    stopRun()
    setSaveDistance(metersToUnit(gpsMeters, unit).toFixed(2))
    setSaveName(suggestedName())
    setSaveNotes('')
    setShowSave(true)
  }

  const changeSaveUnit = (next: DistanceUnit) => {
    if (next === unit) return
    const value = Number(saveDistance)
    if (saveDistance.trim() !== '' && Number.isFinite(value)) {
      const meters = value * metersPerUnit(unit)
      setSaveDistance(metersToUnit(meters, next).toFixed(2))
    }
    setDistanceUnit(next)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const value = Number(saveDistance)
      const meters =
        saveDistance.trim() !== '' && Number.isFinite(value)
          ? Math.max(0, value) * metersPerUnit(unit)
          : undefined
      const id = await saveRun({ distanceMeters: meters, notes: saveNotes, name: saveName })
      setShowSave(false)
      navigate(id != null ? `/runs/${id}` : '/runs')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    discardRun()
    setShowSave(false)
    navigate('/runs')
  }

  const statusText =
    state.status === 'acquiring'
      ? 'Waiting for GPS'
      : state.status === 'running'
        ? 'Tracking'
        : state.status === 'paused'
          ? 'Paused'
          : state.status === 'finished'
            ? 'Finished'
            : 'Ready'

  return (
    <>
      <PageHeader
        title="Run"
        subtitle={statusText}
        onBack={() => navigate('/runs')}
        actions={
          <Segmented
            value={unit}
            onChange={setDistanceUnit}
            label="Distance unit"
            options={[
              { value: 'km', label: 'km' },
              { value: 'mi', label: 'mi' },
            ]}
          />
        }
      />

      {state.status === 'acquiring' && (
        <div className="card" style={{ marginBottom: 14 }}>
          {state.gpsStatus === 'timeout' ||
          state.gpsStatus === 'denied' ||
          state.gpsStatus === 'unavailable' ? (
            <>
              <div className="bold">Couldn&apos;t get a GPS fix</div>
              <div className="small muted">
                {state.gpsStatus === 'denied'
                  ? 'Location permission is off. Allow it in the system settings and retry, or run without GPS and enter the distance at the end.'
                  : 'No usable satellite fix yet. Move somewhere with a clearer view of the sky and retry, or run without GPS and enter the distance at the end.'}
              </div>
              <div className="row wrap" style={{ marginTop: 12 }}>
                {state.gpsStatus === 'denied' && isNative() && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => void openLocationSettings()}
                  >
                    Open settings
                  </button>
                )}
                <button className="btn btn-sm btn-primary" onClick={retryGps}>
                  Retry GPS
                </button>
                <button className="btn btn-sm btn-outline" onClick={startWithoutGps}>
                  Run without GPS
                </button>
                <button className="btn btn-sm btn-outline" onClick={handleDiscard}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                <span className="spinner" aria-hidden="true" />
                <div>
                  <div className="bold">Getting a GPS fix…</div>
                  <div className="small muted">
                    The timer starts as soon as the first fix arrives — nothing is recorded
                    until then.
                  </div>
                </div>
              </div>
              <div className="row wrap" style={{ marginTop: 12 }}>
                <button className="btn btn-sm btn-outline" onClick={startWithoutGps}>
                  Start without GPS
                </button>
                <button className="btn btn-sm btn-outline" onClick={handleDiscard}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {state.gpsStatus === 'denied' && state.status !== 'acquiring' && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="bold">Location permission needed</div>
          <div className="small muted">
            Clarity can only track distance and route with location access. You can
            allow it in the system settings, or run without GPS and enter the distance at
            the end.
          </div>
          <div className="row wrap" style={{ marginTop: 12 }}>
            {isNative() && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => void openLocationSettings()}
              >
                Open settings
              </button>
            )}
            <button
              className="btn btn-sm btn-outline"
              onClick={() => setGpsEnabled(false)}
            >
              Run without GPS
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="row-between">
          <span className={`gps-chip ${state.gpsStatus}`}>
            <Footprints size={14} /> {gpsLabel(state)}
          </span>
          {state.status === 'paused' && <span className="badge medium">Paused</span>}
        </div>

        <div className="run-live">
          <div className="run-distance">
            {distanceValue}
            <span>{unit}</span>
          </div>
          <div className="run-stats">
            <div>
              <div className="stat-value">{formatClock(state.elapsedSeconds)}</div>
              <div className="stat-label">Time</div>
            </div>
            <div>
              <div className="stat-value">{pace}</div>
              <div className="stat-label">Average pace</div>
            </div>
          </div>
        </div>

        <div className="row-between" style={{ marginTop: 16 }}>
          <div>
            <div className="bold">GPS tracking</div>
            <div className="tiny muted">
              {state.gpsEnabled
                ? 'Keeps tracking with the screen locked on Android and iOS.'
                : 'Distance stays at 0 until you enter it after the run.'}
            </div>
          </div>
          <button
            className={`switch ${state.gpsEnabled ? 'on' : ''}`}
            aria-label="Toggle GPS tracking"
            aria-pressed={state.gpsEnabled}
            onClick={() => setGpsEnabled(!state.gpsEnabled)}
          />
        </div>

        <div className="row wrap" style={{ justifyContent: 'center', marginTop: 20 }}>
          {state.status === 'idle' && (
            <button className="btn btn-primary" style={{ padding: '14px 28px' }} onClick={handleStart}>
              <Play size={18} /> Start run
            </button>
          )}
          {state.status === 'running' && (
            <>
              <button className="btn btn-outline" style={{ padding: '14px 24px' }} onClick={pauseRun}>
                <Pause size={18} /> Pause
              </button>
              <button className="btn btn-danger" style={{ padding: '14px 24px' }} onClick={handleStop}>
                <Square size={18} /> Stop
              </button>
            </>
          )}
          {state.status === 'paused' && (
            <>
              <button className="btn btn-primary" style={{ padding: '14px 24px' }} onClick={resumeRun}>
                <Play size={18} /> Resume
              </button>
              <button className="btn btn-danger" style={{ padding: '14px 24px' }} onClick={handleStop}>
                <Square size={18} /> Stop
              </button>
            </>
          )}
          {state.status === 'finished' && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setSaveDistance(metersToUnit(state.distanceMeters, unit).toFixed(2))
                setSaveNotes('')
                setShowSave(true)
              }}
            >
              Save run
            </button>
          )}
        </div>

        {import.meta.env.DEV && state.status !== 'finished' && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="btn btn-sm btn-outline" onClick={() => simulateRun(5000)}>
              Simulate 5 km (dev)
            </button>
          </div>
        )}
      </div>

      <p className="tiny muted" style={{ marginTop: 14, textAlign: 'center' }}>
        Pauses are excluded from time and distance. Every accepted fix is saved on this
        device, so closing the app doesn&apos;t lose the run.
      </p>

      <Dialog
        open={showSave}
        onClose={() => setShowSave(false)}
        title="Save run"
        footer={
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <button className="btn btn-danger" onClick={handleDiscard}>
              Discard
            </button>
            <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      >
        <div className="stack">
          <Field label="Name">
            <TextInput
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Morning loop"
              maxLength={60}
            />
          </Field>
          <div className="row-between">
            <span className="label">Distance unit</span>
            <Segmented
              value={unit}
              onChange={changeSaveUnit}
              label="Save distance unit"
              options={[
                { value: 'km', label: 'km' },
                { value: 'mi', label: 'mi' },
              ]}
            />
          </div>
          <Field label={`Distance (${unit})`}>
            <TextInput
              inputMode="decimal"
              value={saveDistance}
              onChange={(e) => setSaveDistance(e.target.value)}
            />
          </Field>
          <p className="tiny muted">
            GPS measured {distanceValue} {unit}. Editing the distance marks the run as
            manual and hides the route and splits.
          </p>
          <Field label="Notes">
            <RichTextEditor
              value={saveNotes}
              onValueChange={setSaveNotes}
              placeholder="How did it go?"
              size="sm"
              ariaLabel="Run notes"
            />
          </Field>
        </div>
      </Dialog>
    </>
  )
}
