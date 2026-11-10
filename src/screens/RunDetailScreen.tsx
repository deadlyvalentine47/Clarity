import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { deleteRun } from '../db/runGroups'
import type { DistanceUnit } from '../db/types'
import { usePreferences } from '../context/PreferencesContext'
import { formatDateTime } from '../lib/dates'
import { plural } from '../lib/format'
import {
  distanceLabel,
  formatClock,
  formatPace,
  formatPaceValue,
  splitSeconds,
} from '../lib/geo'
import { altitudeSource, altitudeStats, hasAltitude } from '../lib/route3d'
import { ConfirmDialog, EmptyState, Field, PageHeader, Segmented, TextArea, TextInput } from '../components/ui'
import RouteMap from '../components/RouteMap'
import RouteMap3D from '../components/RouteMap3D'
import ElevationProfile from '../components/ElevationProfile'

export default function RunDetailScreen() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { prefs, setDistanceUnit } = usePreferences()
  const unit = prefs.distanceUnit
  const id = Number(runId)

  const run = useLiveQuery(
    async () => (Number.isFinite(id) ? db.runs.get(id) : undefined),
    [id],
    undefined,
  )
  const track = useLiveQuery(
    async () => (Number.isFinite(id) ? db.runTracks.get(id) : undefined),
    [id],
    undefined,
  )
  const points = track?.points ?? []

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [detailsFor, setDetailsFor] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (run?.id != null && run.id !== detailsFor) {
      setName(run.name ?? '')
      setNotes(run.notes)
      setDetailsFor(run.id)
    }
  }, [run?.id, run?.name, run?.notes, detailsFor])

  const splits = useMemo(
    () => (run && !run.isManualDistance ? splitSeconds(points, unit) : []),
    [run, points, unit],
  )

  const [routeView, setRouteView] = useState<'2d' | '3d' | null>(null)
  const routePoints = useMemo(
    () => (run && !run.isManualDistance ? points : []),
    [run, points],
  )
  const elevation = useMemo(() => altitudeStats(routePoints), [routePoints])
  const elevationSource = useMemo(() => altitudeSource(routePoints), [routePoints])
  const canShow3d =
    hasAltitude(routePoints) && elevation != null && elevation.max - elevation.min >= 3
  const view = routeView ?? (canShow3d ? '3d' : '2d')

  if (run === undefined) return null

  if (!run) {
    return (
      <>
        <PageHeader title="Run" onBack={() => navigate('/runs')} />
        <div className="card">
          <EmptyState
            icon={<Trash2 size={40} />}
            title="Run not found"
            subtitle="It may have been deleted."
          />
        </div>
      </>
    )
  }

  const dirty = name.trim() !== (run.name ?? '') || notes.trim() !== run.notes

  return (
    <>
      <PageHeader
        title={run.name?.trim() || formatDateTime(run.startedAt)}
        subtitle={`${distanceLabel(run.distanceMeters, unit)} · ${formatClock(run.durationSeconds)}`}
        onBack={() => navigate('/runs')}
        wrapTitle
        actions={
          <>
            <Segmented
              value={unit}
              onChange={setDistanceUnit}
              label="Distance unit"
              options={[
                { value: 'km', label: 'km' },
                { value: 'mi', label: 'mi' },
              ]}
            />
            <button
              className="btn btn-sm btn-outline"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete run"
            >
              <Trash2 size={16} /> Delete
            </button>
          </>
        }
      />

      <div className="grid-3" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="section-label">Distance</div>
          <div className="stat-value" style={{ marginTop: 6 }}>
            {distanceLabel(run.distanceMeters, unit)}
          </div>
          {run.isManualDistance && <div className="tiny muted">Entered manually</div>}
        </div>
        <div className="card">
          <div className="section-label">Time</div>
          <div className="stat-value" style={{ marginTop: 6 }}>
            {formatClock(run.durationSeconds)}
          </div>
          <div className="tiny muted">{plural(splits.length, 'split')}</div>
        </div>
        <div className="card">
          <div className="section-label">Average pace</div>
          <div className="stat-value" style={{ marginTop: 6 }}>
            {formatPace(run.durationSeconds, run.distanceMeters, unit)}
          </div>
          <div className="tiny muted">
            {run.endedAt ? formatDateTime(run.endedAt) : 'Not finished'}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <span className="section-label">Route</span>
          <div className="row" style={{ gap: 8 }}>
            {canShow3d && (
              <Segmented
                value={view}
                onChange={setRouteView}
                label="Route view"
                options={[
                  { value: '2d', label: '2D' },
                  { value: '3d', label: '3D' },
                ]}
              />
            )}
            {run.isManualDistance && <span className="badge">Manual distance</span>}
          </div>
        </div>
        {view === '3d' && canShow3d ? (
          <RouteMap3D points={routePoints} />
        ) : (
          <RouteMap points={run.isManualDistance ? [] : points} />
        )}
        {run.isManualDistance && (
          <p className="tiny muted" style={{ marginTop: 8 }}>
            This run was saved with a corrected distance, so the GPS route and splits are
            hidden.
          </p>
        )}
      </div>

      {elevation && elevation.max - elevation.min >= (elevationSource === 'barometer' ? 1 : 5) && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <span className="section-label">Elevation</span>
            <span className="tiny muted">
              {elevationSource === 'barometer' ? 'Barometric' : 'GPS'}
            </span>
          </div>
          <ElevationProfile points={routePoints} unit={unit} />
          <p className="tiny muted" style={{ marginTop: 8 }}>
            {Math.round(elevation.min)}–{Math.round(elevation.max)} m · gain +
            {Math.round(elevation.gain)} m · loss −{Math.round(elevation.loss)} m
            {run.distanceMeters <= 2000 && (
              <>
                {' '}
                · ≈{Math.max(1, Math.round((elevation.max - elevation.min) / 3))} floors at 3 m
              </>
            )}
          </p>
        </div>
      )}

      {!run.isManualDistance && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-label" style={{ marginBottom: 6 }}>
            Splits
          </div>
          {splits.length === 0 ? (
            <p className="small muted">
              Not enough recorded distance for a {unit} split.
            </p>
          ) : (
            <div>
              {splits.map((split) => (
                <div className="split-row" key={split.index}>
                  <span className="split-index">
                    {split.index} {unit}
                  </span>
                  <span className="grow" />
                  <span className="bold">{formatClock(split.seconds)}</span>
                  <span className="small muted">
                    {formatPaceValue(split.seconds, unit)}
                  </span>
                  <span className="tiny muted">
                    {formatClock(split.cumulativeSeconds)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="section-label" style={{ marginBottom: 8 }}>
          Details
        </div>
        <Field label="Name">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning loop"
            maxLength={60}
          />
        </Field>
        <Field label="Notes">
          <TextArea
            value={notes}
            onValueChange={setNotes}
            placeholder="How did the run feel?"
            preview="below"
          />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <button
            className="btn btn-sm btn-primary"
            disabled={!dirty}
            onClick={() => {
              if (run.id != null) {
                void db.runs.update(run.id, { name: name.trim(), notes: notes.trim() })
                setName(name.trim())
                setNotes(notes.trim())
              }
            }}
          >
            Save changes
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete run?"
        message="This removes the run, its distance and its route from history."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (run.id != null) void deleteRun(run.id)
          setConfirmDelete(false)
          navigate('/runs')
        }}
      />
    </>
  )
}
