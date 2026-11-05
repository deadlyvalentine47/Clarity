import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Footprints, Play } from 'lucide-react'
import { db } from '../db/db'
import type { DistanceUnit, RunSession } from '../db/types'
import { usePreferences } from '../context/PreferencesContext'
import { formatDateTime } from '../lib/dates'
import { plural } from '../lib/format'
import {
  distanceLabel,
  formatClock,
  formatPace,
  formatPaceValue,
  metersToUnit,
} from '../lib/geo'
import {
  adoptSnapshot,
  discardRun,
  getState,
  recoverSnapshot,
  saveRecoveredRun,
  type RecoveredRun,
  type RunStatus,
} from '../lib/runStore'
import { EmptyState, PageHeader } from '../components/ui'
import RouteMap from '../components/RouteMap'

type Range = 'This week' | 'This month' | 'All'
const RANGES: Range[] = ['This week', 'This month', 'All']

function periodStart(range: Range): number {
  const now = new Date()
  if (range === 'This week') {
    const start = new Date(now)
    // Monday-based week, matching the rest of the app's ISO weekdays.
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    start.setHours(0, 0, 0, 0)
    return start.getTime()
  }
  if (range === 'This month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return 0
}

interface Summary {
  distanceMeters: number
  seconds: number
  count: number
  bestPace: number | null
}

function summarize(runs: RunSession[], unit: DistanceUnit): Summary {
  const distanceMeters = runs.reduce((sum, run) => sum + run.distanceMeters, 0)
  const seconds = runs.reduce((sum, run) => sum + run.durationSeconds, 0)
  const bestPace = runs.reduce<number | null>((best, run) => {
    if (run.distanceMeters < 20 || run.durationSeconds <= 0) return best
    const pace = run.durationSeconds / metersToUnit(run.distanceMeters, unit)
    return best == null || pace < best ? pace : best
  }, null)
  return { distanceMeters, seconds, count: runs.length, bestPace }
}

export default function RunsScreen() {
  const navigate = useNavigate()
  const { prefs, setDistanceUnit } = usePreferences()
  const unit = prefs.distanceUnit
  const [range, setRange] = useState<Range>('All')
  const [recovered, setRecovered] = useState<RecoveredRun | null>(null)
  const [activeRun, setActiveRun] = useState<RunStatus | null>(null)
  const [savingRecovered, setSavingRecovered] = useState(false)

  const runs = useLiveQuery(
    async () => db.runs.orderBy('startedAt').reverse().toArray(),
    [],
    [],
  )

  useEffect(() => {
    const live = getState()
    if (live.status === 'running' || live.status === 'paused') {
      setActiveRun(live.status)
      setRecovered(null)
      return
    }
    setActiveRun(null)
    setRecovered(recoverSnapshot())
  }, [])

  const all = runs ?? []
  const thisWeek = useMemo(
    () => all.filter((run) => run.startedAt >= periodStart('This week')),
    [all],
  )
  const thisMonth = useMemo(
    () => all.filter((run) => run.startedAt >= periodStart('This month')),
    [all],
  )

  const visible = useMemo(() => {
    if (range === 'All') return all
    const start = periodStart(range)
    return all.filter((run) => run.startedAt >= start)
  }, [all, range])

  const resume = async () => {
    if (!recovered) return
    adoptSnapshot(recovered.snapshot)
    setRecovered(null)
    navigate('/runs/live')
  }

  const saveRecovered = async () => {
    setSavingRecovered(true)
    try {
      const id = await saveRecoveredRun()
      setRecovered(null)
      if (id != null) navigate(`/runs/${id}`)
    } finally {
      setSavingRecovered(false)
    }
  }

  const discardRecovered = () => {
    discardRun()
    setRecovered(null)
  }

  const stats: Array<[string, Summary]> = [
    ['This week', summarize(thisWeek, unit)],
    ['This month', summarize(thisMonth, unit)],
    ['All time', summarize(all, unit)],
  ]

  const recoveredIsStale =
    recovered != null && (recovered.stale || recovered.snapshot.status === 'finished')

  return (
    <>
      <PageHeader
        title="Runs"
        subtitle="GPS distance, pace and route"
        actions={
          <div className="segmented" aria-label="Distance unit">
            {(['km', 'mi'] as DistanceUnit[]).map((option) => (
              <button
                key={option}
                className={unit === option ? 'active' : ''}
                onClick={() => setDistanceUnit(option)}
              >
                {option}
              </button>
            ))}
          </div>
        }
      />

      {activeRun && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div className="bold">Run in progress</div>
              <div className="small muted">
                {activeRun === 'paused'
                  ? 'Paused — open the live screen to resume.'
                  : 'Distance, time and route are still tracking.'}
              </div>
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => navigate('/runs/live')}>
              Open
            </button>
          </div>
        </div>
      )}

      {recovered && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div className="bold">
                {recoveredIsStale ? 'Unfinished run found' : 'Resume your run?'}
              </div>
              <div className="small muted">
                {distanceLabel(recovered.snapshot.distanceMeters, unit)} ·{' '}
                {formatClock(recovered.snapshot.elapsedSeconds)} ·{' '}
                {formatDateTime(recovered.snapshot.startedAt ?? Date.now())}
              </div>
              <div className="tiny muted">
                {recoveredIsStale
                  ? 'Saved on this device but not finished. Save it to history or discard it.'
                  : 'The app closed before you saved this run.'}
              </div>
            </div>
          </div>
          <div className="row wrap" style={{ marginTop: 12 }}>
            {recoveredIsStale ? (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => void saveRecovered()}
                disabled={savingRecovered}
              >
                {savingRecovered ? 'Saving…' : 'Save run'}
              </button>
            ) : (
              <button className="btn btn-sm btn-primary" onClick={() => void resume()}>
                <Play size={16} /> Resume
              </button>
            )}
            <button className="btn btn-sm btn-outline" onClick={discardRecovered}>
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="grid-3" style={{ marginBottom: 14 }}>
        {stats.map(([label, summary]) => (
          <div key={label} className="card">
            <div className="section-label">{label}</div>
            <div className="stat-value" style={{ marginTop: 6 }}>
              {distanceLabel(summary.distanceMeters, unit)}
            </div>
            <div className="small muted">
              {formatClock(summary.seconds)} · {plural(summary.count, 'run')}
            </div>
            <div className="tiny muted">
              Best {summary.bestPace != null ? formatPaceValue(summary.bestPace, unit) : '—'}
            </div>
          </div>
        ))}
      </div>

      <div className="chip-row" style={{ marginBottom: 14 }}>
        {RANGES.map((option) => (
          <button
            key={option}
            className={`chip ${range === option ? 'active' : ''}`}
            onClick={() => setRange(option)}
          >
            {option}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Footprints size={40} />}
            title={all.length === 0 ? 'No runs yet' : 'No runs in this period'}
            subtitle={
              all.length === 0
                ? 'Start a run — distance, pace and route are tracked with GPS.'
                : 'Try a wider range.'
            }
            action={
              all.length === 0 ? (
                <button className="btn btn-primary" onClick={() => navigate('/runs/live')}>
                  <Play size={16} /> Start a run
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="stack">
          {visible.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              unit={unit}
              onOpen={() => navigate(`/runs/${run.id}`)}
            />
          ))}
        </div>
      )}

      <button className="fab" aria-label="Start a run" onClick={() => navigate('/runs/live')}>
        <Play size={26} />
      </button>
    </>
  )
}

function RunCard({
  run,
  unit,
  onOpen,
}: {
  run: RunSession
  unit: DistanceUnit
  onOpen: () => void
}) {
  return (
    <div className="card clickable" onClick={onOpen}>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="grow" style={{ minWidth: 0 }}>
          {run.name?.trim() && (
            <div className="bold" style={{ marginBottom: 2 }}>
              {run.name.trim()}
            </div>
          )}
          <div className="stat-value">{distanceLabel(run.distanceMeters, unit)}</div>
          <div className="small muted">
            {formatClock(run.durationSeconds)} ·{' '}
            {formatPace(run.durationSeconds, run.distanceMeters, unit)}
          </div>
          <div className="tiny muted">
            {formatDateTime(run.startedAt)}
            {run.isManualDistance ? ' · manual distance' : ''}
          </div>
        </div>
        <RouteMap points={run.isManualDistance ? [] : run.points} compact />
      </div>
    </div>
  )
}
