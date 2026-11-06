import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Footprints,
  FolderPlus,
  GripVertical,
  Pencil,
  Play,
  Trash2,
  X,
} from 'lucide-react'
import { db } from '../db/db'
import type { DistanceUnit, RunGroup, RunSession } from '../db/types'
import {
  addRunsToGroup,
  buildRunRows,
  createRunGroup,
  deleteRunGroup,
  moveRunInGroupByOffset,
  moveRunToGroup,
  moveTopLevelRunByOffset,
  moveTopLevelRunItem,
  removeRunFromGroup,
  renameRunGroup,
  setRunGroupCollapsed,
  type RunItem,
  type RunRow,
} from '../db/runGroups'
import { endOfDay, formatDateTime, MONTHS, monthRange, startOfDay, toDateKey } from '../lib/dates'
import { plural } from '../lib/format'
import {
  distanceLabel,
  formatClock,
  formatPace,
  formatPaceValue,
  metersToUnit,
} from '../lib/geo'
import { useDragAutoScroll } from '../lib/dragAutoScroll'
import {
  adoptSnapshot,
  discardRun,
  getState,
  recoverSnapshot,
  saveRecoveredRun,
  type RecoveredRun,
  type RunStatus,
} from '../lib/runStore'
import { usePreferences } from '../context/PreferencesContext'
import { Checkbox, ConfirmDialog, Dialog, EmptyState, Field, PageHeader, TextInput } from '../components/ui'
import { MonthYearPicker } from './budget/shared'
import RouteMap from '../components/RouteMap'

type RangeMode = 'month' | 'day' | 'year'

/** Drop position as the pointer shows it; the DB layer takes before/after. */
type DropPos = 'above' | 'below'

const RANGE_MODES: { mode: RangeMode; label: string }[] = [
  { mode: 'month', label: 'Month' },
  { mode: 'day', label: 'Day' },
  { mode: 'year', label: 'Year' },
]

/** A starting point for the session name; the user can always type over it. */
function suggestedSessionName(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Morning session'
  if (hour < 17) return 'Afternoon session'
  if (hour < 21) return 'Evening session'
  return 'Night session'
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

  const [mode, setMode] = useState<RangeMode>('month')
  // One local date anchors all three modes, so switching Month → Day keeps the
  // same month and Year → Month keeps the same year (same as All transactions).
  const [anchor, setAnchor] = useState(() => new Date())
  const [recovered, setRecovered] = useState<RecoveredRun | null>(null)
  const [activeRun, setActiveRun] = useState<RunStatus | null>(null)
  const [savingRecovered, setSavingRecovered] = useState(false)

  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [groupName, setGroupName] = useState<string | null>(null)
  const [addToOpen, setAddToOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<RunGroup | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<RunGroup | null>(null)
  const [creatingGroup, setCreatingGroup] = useState(false)

  const [dragged, setDragged] = useState<RunItem | null>(null)
  const [runDrop, setRunDrop] = useState<{ id: number; pos: DropPos } | null>(null)
  const [groupDrop, setGroupDrop] = useState<{ id: number; pos: DropPos | 'inside' } | null>(null)

  useDragAutoScroll(dragged != null)

  const runs = useLiveQuery(
    async () => db.runs.orderBy('startedAt').reverse().toArray(),
    [],
    [],
  )
  const groups = useLiveQuery(async () => db.runGroups.toArray(), [], [])

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

  const all = useMemo(() => runs ?? [], [runs])
  const year = anchor.getFullYear()
  const month = anchor.getMonth() + 1
  const dayKey = toDateKey(anchor)

  const [start, end] = useMemo<[number, number]>(() => {
    if (mode === 'day') {
      const ts = anchor.getTime()
      return [startOfDay(ts), endOfDay(ts)]
    }
    if (mode === 'month') return monthRange(year, month)
    return [new Date(year, 0, 1).getTime(), new Date(year, 11, 31, 23, 59, 59, 999).getTime()]
  }, [mode, anchor, year, month])

  const visibleRuns = useMemo(
    () => all.filter((run) => run.startedAt >= start && run.startedAt <= end),
    [all, start, end],
  )

  // Only sessions with a run in the period are listed; a session that spans
  // months shows just the runs inside the selected period.
  const visibleGroups = useMemo(() => {
    const used = new Set(visibleRuns.map((run) => run.groupId).filter((id): id is number => id != null))
    return (groups ?? []).filter((group) => group.id != null && used.has(group.id))
  }, [groups, visibleRuns])

  const rows = useMemo<RunRow[]>(
    () => buildRunRows(visibleRuns, visibleGroups),
    [visibleRuns, visibleGroups],
  )

  const stats = useMemo(() => summarize(visibleRuns, unit), [visibleRuns, unit])
  const allTime = useMemo(() => summarize(all, unit), [all, unit])

  const groupCounts = useMemo(
    () =>
      (groups ?? [])
        .map((group) => ({
          group,
          count: all.filter((run) => run.groupId === group.id).length,
        }))
        .sort((a, b) => b.count - a.count || a.group.name.localeCompare(b.group.name)),
    [groups, all],
  )

  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear(), year])
    for (const run of all) set.add(new Date(run.startedAt).getFullYear())
    return [...set].sort((a, b) => b - a)
  }, [all, year])

  const rangeLabel =
    mode === 'day'
      ? anchor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : mode === 'month'
        ? `${MONTHS[month - 1]} ${year}`
        : String(year)

  /** Move the anchor to `y/m/d`, clamping the day to the target month. */
  const setPeriod = (y: number, m: number, day?: number) => {
    const safeDay = Math.min(day ?? anchor.getDate(), new Date(y, m, 0).getDate())
    setAnchor(new Date(y, m - 1, safeDay, 12))
  }

  const step = (delta: -1 | 1) => {
    if (mode === 'day') {
      const next = new Date(anchor)
      next.setDate(next.getDate() + delta)
      setAnchor(next)
      return
    }
    if (mode === 'year') {
      setPeriod(year + delta, month)
      return
    }
    const target = new Date(year, month - 1 + delta, 1, 12)
    setPeriod(target.getFullYear(), target.getMonth() + 1)
  }

  const goToday = () => setAnchor(new Date())

  const changeDay = (value: string) => {
    const [y, m, d] = value.split('-').map(Number)
    if (!y || !m || !d) return
    setAnchor(new Date(y, m - 1, d, 12))
  }

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

  // ---------------------------------------------------------------- sessions

  const startSelecting = () => {
    setSelecting(true)
    setSelected(new Set())
  }

  const cancelSelecting = () => {
    setSelecting(false)
    setSelected(new Set())
  }

  const toggleSelected = (runId: number) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(runId)) next.delete(runId)
      else next.add(runId)
      return next
    })
  }

  const openGroupDialog = () => {
    if (selected.size < 2) return
    setGroupName(suggestedSessionName())
  }

  const createGroup = async () => {
    if (groupName == null || selected.size === 0) return
    setCreatingGroup(true)
    try {
      await createRunGroup(groupName, [...selected])
      setGroupName(null)
      cancelSelecting()
    } finally {
      setCreatingGroup(false)
    }
  }

  const addSelectedToGroup = async (groupId: number) => {
    await addRunsToGroup([...selected], groupId)
    setAddToOpen(false)
    cancelSelecting()
  }

  // -------------------------------------------------------------------- drag

  const resetDrag = () => {
    setDragged(null)
    setRunDrop(null)
    setGroupDrop(null)
  }

  const startDrag = (item: RunItem) => {
    setDragged(item)
    setRunDrop(null)
    setGroupDrop(null)
  }

  const dropOnRun = (target: RunSession, containerGroupId: number | null, position: DropPos) => {
    if (!dragged || target.id == null) {
      resetDrag()
      return
    }
    if (dragged.kind === 'run' && dragged.id === target.id) {
      resetDrag()
      return
    }
    if (dragged.kind === 'run') {
      if (containerGroupId != null) {
        void moveRunToGroup(dragged.id, containerGroupId, {
          targetRunId: target.id,
          position: position === 'above' ? 'before' : 'after',
        })
      } else {
        void moveTopLevelRunItem(
          dragged,
          { kind: 'run', id: target.id },
          position === 'above' ? 'before' : 'after',
        )
      }
    } else {
      // A session dropped on a run takes that row's place (nested targets use
      // the session that contains them).
      const targetItem: RunItem =
        containerGroupId != null ? { kind: 'group', id: containerGroupId } : { kind: 'run', id: target.id }
      void moveTopLevelRunItem(
        dragged,
        targetItem,
        position === 'above' ? 'before' : 'after',
      )
    }
    resetDrag()
  }

  const dropOnGroup = (groupId: number, position: DropPos | 'inside') => {
    if (!dragged) {
      resetDrag()
      return
    }
    if (dragged.kind === 'run') {
      void moveRunToGroup(dragged.id, groupId, { position: 'after' })
      void setRunGroupCollapsed(groupId, false)
    } else {
      void moveTopLevelRunItem(
        dragged,
        { kind: 'group', id: groupId },
        position === 'above' ? 'before' : 'after',
      )
    }
    resetDrag()
  }

  const dropToEnd = () => {
    if (!dragged) return
    void moveTopLevelRunItem(dragged, null)
    resetDrag()
  }

  const recoveredIsStale =
    recovered != null && (recovered.stale || recovered.snapshot.status === 'finished')

  return (
    <>
      <PageHeader
        title="Runs"
        subtitle={rangeLabel}
        actions={
          <>
            <button className="btn btn-sm btn-outline" onClick={goToday}>
              <CalendarDays size={16} /> Today
            </button>
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
          </>
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

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="chip-row" role="group" aria-label="Filter by period" style={{ marginBottom: 12 }}>
          {RANGE_MODES.map(({ mode: value, label }) => (
            <button
              key={value}
              type="button"
              className={`chip ${mode === value ? 'active' : ''}`}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="period-nav">
          <button
            type="button"
            className="icon-btn"
            aria-label={mode === 'day' ? 'Previous day' : mode === 'year' ? 'Previous year' : 'Previous month'}
            onClick={() => step(-1)}
          >
            <ChevronLeft size={20} />
          </button>

          {mode === 'month' && (
            <MonthYearPicker
              year={year}
              month={month}
              years={years}
              onChange={(y, m) => setPeriod(y, m)}
            />
          )}

          {mode === 'day' && (
            <input
              className="input"
              type="date"
              aria-label="Date"
              style={{ width: 'auto', minWidth: 150 }}
              value={dayKey}
              onChange={(e) => changeDay(e.target.value)}
            />
          )}

          {mode === 'year' && (
            <select
              className="select"
              aria-label="Year"
              style={{ width: 'auto', minWidth: 96 }}
              value={year}
              onChange={(e) => setPeriod(Number(e.target.value), month)}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="icon-btn"
            aria-label={mode === 'day' ? 'Next day' : mode === 'year' ? 'Next year' : 'Next month'}
            onClick={() => step(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="hero-row" style={{ marginTop: 0 }}>
          <div>
            <div className="hero-label">Distance</div>
            <div className="bold">{distanceLabel(stats.distanceMeters, unit)}</div>
          </div>
          <div>
            <div className="hero-label">Time</div>
            <div className="bold">{formatClock(stats.seconds)}</div>
          </div>
          <div>
            <div className="hero-label">Runs</div>
            <div className="bold">{stats.count}</div>
          </div>
        </div>
        <div className="tiny muted" style={{ marginTop: 10 }}>
          {plural(stats.count, 'run')}
          {stats.count > 0 ? ` · best ${stats.bestPace != null ? formatPaceValue(stats.bestPace, unit) : '—'}` : ''}
          {' · all time '}
          {distanceLabel(allTime.distanceMeters, unit)} in {plural(allTime.count, 'run')}
        </div>
      </div>

      {selecting ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="bold">{plural(selected.size, 'run')} selected</div>
          <div className="tiny muted">Pick two or more runs to bundle them into a new session.</div>
          <div className="row wrap" style={{ marginTop: 10, gap: 8 }}>
            <button className="btn btn-sm btn-outline" onClick={cancelSelecting}>
              Cancel
            </button>
            <span className="grow" />
            {groupCounts.length > 0 && (
              <button
                className="btn btn-sm btn-outline"
                onClick={() => setAddToOpen(true)}
                disabled={selected.size === 0}
              >
                Add to session
              </button>
            )}
            <button
              className="btn btn-sm btn-primary"
              onClick={openGroupDialog}
              disabled={selected.size < 2}
            >
              Group
            </button>
          </div>
        </div>
      ) : (
        <div className="row-between" style={{ margin: '0 2px 8px' }}>
          <span className="section-label">History</span>
          <button
            className="btn btn-sm btn-outline"
            onClick={startSelecting}
            disabled={visibleRuns.length < 2}
          >
            <FolderPlus size={16} /> Group runs
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Footprints size={40} />}
            title={all.length === 0 ? 'No runs yet' : 'No runs in this period'}
            subtitle={
              all.length === 0
                ? 'Start a run — distance, pace and route are tracked with GPS.'
                : `Nothing recorded in ${rangeLabel}.`
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
          {rows.map((row, index) =>
            row.kind === 'group' ? (
              <RunGroupCard
                key={`group-${row.group.id}`}
                group={row.group}
                runs={row.runs}
                unit={unit}
                collapsed={row.group.isCollapsed === true}
                onToggleCollapse={() =>
                  void setRunGroupCollapsed(row.group.id!, row.group.isCollapsed !== true)
                }
                selecting={selecting}
                dragKind={dragged?.kind ?? null}
                dragging={dragged?.kind === 'group' && dragged.id === row.group.id}
                dropPos={groupDrop != null && groupDrop.id === row.group.id ? groupDrop.pos : null}
                onDragStart={() => startDrag({ kind: 'group', id: row.group.id! })}
                onDragEnd={resetDrag}
                onDragOver={(pos) => {
                  setGroupDrop({ id: row.group.id!, pos })
                  setRunDrop(null)
                }}
                onDrop={(pos) => dropOnGroup(row.group.id!, pos)}
                onMoveUp={() => void moveTopLevelRunByOffset({ kind: 'group', id: row.group.id! }, -1)}
                onMoveDown={() => void moveTopLevelRunByOffset({ kind: 'group', id: row.group.id! }, 1)}
                canMoveUp={index > 0}
                canMoveDown={index < rows.length - 1}
                onEdit={() => setEditingGroup(row.group)}
                onDelete={() => setDeletingGroup(row.group)}
              >
                {row.runs.map((run, memberIndex) => (
                  <RunCard
                    key={run.id}
                    run={run}
                    unit={unit}
                    containerGroupId={row.group.id!}
                    selecting={selecting}
                    selected={run.id != null && selected.has(run.id)}
                    onToggle={() => run.id != null && toggleSelected(run.id)}
                    onOpen={() => navigate(`/runs/${run.id}`)}
                    dragging={dragged?.kind === 'run' && dragged.id === run.id}
                    dropPos={runDrop != null && runDrop.id === run.id ? runDrop.pos : null}
                    onDragStart={() => run.id != null && startDrag({ kind: 'run', id: run.id })}
                    onDragEnd={resetDrag}
                    onDragOver={(pos) => {
                      if (run.id == null) return
                      setRunDrop({ id: run.id, pos })
                      setGroupDrop(null)
                    }}
                    onDrop={(pos) => dropOnRun(run, row.group.id!, pos)}
                    onMoveUp={() => run.id != null && void moveRunInGroupByOffset(run.id, -1)}
                    onMoveDown={() => run.id != null && void moveRunInGroupByOffset(run.id, 1)}
                    canMoveUp={memberIndex > 0}
                    canMoveDown={memberIndex < row.runs.length - 1}
                    onRemoveFromGroup={() => run.id != null && void removeRunFromGroup(run.id)}
                  />
                ))}
              </RunGroupCard>
            ) : (
              <RunCard
                key={row.run.id}
                run={row.run}
                unit={unit}
                containerGroupId={null}
                selecting={selecting}
                selected={row.run.id != null && selected.has(row.run.id)}
                onToggle={() => row.run.id != null && toggleSelected(row.run.id)}
                onOpen={() => navigate(`/runs/${row.run.id}`)}
                dragging={dragged?.kind === 'run' && dragged.id === row.run.id}
                dropPos={runDrop != null && runDrop.id === row.run.id ? runDrop.pos : null}
                onDragStart={() => row.run.id != null && startDrag({ kind: 'run', id: row.run.id })}
                onDragEnd={resetDrag}
                onDragOver={(pos) => {
                  if (row.run.id == null) return
                  setRunDrop({ id: row.run.id, pos })
                  setGroupDrop(null)
                }}
                onDrop={(pos) => dropOnRun(row.run, null, pos)}
                onMoveUp={() => row.run.id != null && void moveTopLevelRunByOffset({ kind: 'run', id: row.run.id }, -1)}
                onMoveDown={() => row.run.id != null && void moveTopLevelRunByOffset({ kind: 'run', id: row.run.id }, 1)}
                canMoveUp={index > 0}
                canMoveDown={index < rows.length - 1}
              />
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
              {dragged.kind === 'group' ? 'Move session to the end' : 'Move run to the end (outside sessions)'}
            </div>
          )}
        </div>
      )}

      {!selecting && (
        <p className="tiny muted" style={{ marginTop: 14, textAlign: 'center' }}>
          Drag the handle (or use ↑ / ↓) to reorder. Runs never moved by hand stay sorted by
          start time.
        </p>
      )}

      <button className="fab" aria-label="Start a run" onClick={() => navigate('/runs/live')}>
        <Play size={26} />
      </button>

      <Dialog open={addToOpen} onClose={() => setAddToOpen(false)} title="Add to session">
        <div className="stack">
          {groupCounts.map(({ group, count }) => (
            <button
              key={group.id}
              className="btn btn-outline btn-block"
              style={{ justifyContent: 'space-between' }}
              onClick={() => void addSelectedToGroup(group.id!)}
            >
              <span className="truncate" style={{ textAlign: 'left' }}>
                {group.name}
              </span>
              <span className="tiny muted">{plural(count, 'run')}</span>
            </button>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          {plural(selected.size, 'run')} will be added to the session and shown expanded.
        </p>
      </Dialog>

      <Dialog
        open={groupName != null}
        onClose={() => setGroupName(null)}
        title="New session"
        footer={
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-outline" onClick={() => setGroupName(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void createGroup()}
              disabled={creatingGroup || groupName == null || !groupName.trim()}
            >
              {creatingGroup ? 'Grouping…' : 'Group runs'}
            </button>
          </div>
        }
      >
        <div className="stack">
          <Field label="Session name">
            <TextInput
              value={groupName ?? ''}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Morning walk-run"
              maxLength={60}
            />
          </Field>
          <p className="tiny muted">
            {plural(selected.size, 'run')} will be bundled into one session. They stay in history
            and can be ungrouped later.
          </p>
        </div>
      </Dialog>

      {editingGroup && (
        <Dialog
          open
          onClose={() => setEditingGroup(null)}
          title="Rename session"
          footer={
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setEditingGroup(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (editingGroup.id != null) void renameRunGroup(editingGroup.id, editingGroup.name)
                  setEditingGroup(null)
                }}
                disabled={!editingGroup.name.trim()}
              >
                Save
              </button>
            </div>
          }
        >
          <Field label="Session name">
            <TextInput
              value={editingGroup.name}
              onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
              maxLength={60}
            />
          </Field>
        </Dialog>
      )}

      <ConfirmDialog
        open={deletingGroup != null}
        title="Delete session"
        message={`Delete "${deletingGroup?.name}"? Its runs stay in history and return to the main list; nothing is deleted.`}
        confirmLabel="Delete session"
        onCancel={() => setDeletingGroup(null)}
        onConfirm={async () => {
          if (deletingGroup?.id != null) await deleteRunGroup(deletingGroup.id)
          setDeletingGroup(null)
        }}
      />
    </>
  )
}

function RunGroupCard({
  group,
  runs,
  unit,
  collapsed,
  onToggleCollapse,
  selecting,
  dragKind,
  dragging,
  dropPos,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onEdit,
  onDelete,
  children,
}: {
  group: RunGroup
  runs: RunSession[]
  unit: DistanceUnit
  collapsed: boolean
  onToggleCollapse: () => void
  selecting: boolean
  dragKind: 'run' | 'group' | null
  dragging: boolean
  dropPos: DropPos | 'inside' | null
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (pos: DropPos | 'inside') => void
  onDrop: (pos: DropPos | 'inside') => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  onEdit: () => void
  onDelete: () => void
  children: ReactNode
}) {
  const meters = runs.reduce((sum, run) => sum + run.distanceMeters, 0)
  const seconds = runs.reduce((sum, run) => sum + run.durationSeconds, 0)
  const firstAt = runs.length > 0 ? Math.min(...runs.map((run) => run.startedAt)) : null
  const lastAt = runs.length > 0 ? Math.max(...runs.map((run) => run.startedAt)) : null
  const clock = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const range =
    firstAt != null && lastAt != null && firstAt !== lastAt ? `${clock(firstAt)} – ${clock(lastAt)}` : ''

  const dropPosition = (event: React.DragEvent<HTMLDivElement>): DropPos | 'inside' => {
    if (dragKind === 'run') return 'inside'
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientY < rect.top + rect.height / 2 ? 'above' : 'below'
  }

  return (
    <div
      className={`card run-group ${dragging ? 'dragging' : ''} ${dropPos ? `drop-${dropPos}` : ''}`}
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
        className="run-group-head"
        draggable={!selecting}
        onDragStart={(e) => {
          e.stopPropagation()
          if (selecting) return
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', `run-group:${group.id}`)
          onDragStart()
        }}
        onDragEnd={onDragEnd}
      >
        {!selecting && (
          <span className="drag-handle" title="Drag to reorder session" aria-hidden>
            <GripVertical size={16} />
          </span>
        )}
        <button
          className="grow run-group-toggle"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${group.name}`}
        >
          <span className="run-group-name bold">
            <span className="run-group-chevron">
              {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            </span>
            <span className="wrap-anywhere">{group.name}</span>
          </span>
          <span className="tiny muted">
            {plural(runs.length, 'run')} · {distanceLabel(meters, unit)} · {formatClock(seconds)}
            {range ? ` · ${range}` : ''}
          </span>
        </button>
        {!selecting && (
          <div className="icon-actions">
            <button
              className="icon-btn"
              aria-label="Move session up"
              disabled={!canMoveUp}
              onClick={onMoveUp}
            >
              <ChevronUp size={15} />
            </button>
            <button
              className="icon-btn"
              aria-label="Move session down"
              disabled={!canMoveDown}
              onClick={onMoveDown}
            >
              <ChevronDown size={15} />
            </button>
            <button className="icon-btn" aria-label="Rename session" onClick={onEdit}>
              <Pencil size={16} />
            </button>
            <button className="icon-btn" aria-label="Delete session" onClick={onDelete}>
              <Trash2 size={16} color="var(--error)" />
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="run-group-body">
          {runs.length === 0 ? (
            <div className="run-group-empty">Drag runs here to add them to this session</div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  )
}

function RunCard({
  run,
  unit,
  containerGroupId,
  selecting,
  selected,
  onToggle,
  onOpen,
  dragging,
  dropPos,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onRemoveFromGroup,
}: {
  run: RunSession
  unit: DistanceUnit
  containerGroupId: number | null
  selecting: boolean
  selected: boolean
  onToggle: () => void
  onOpen: () => void
  dragging: boolean
  dropPos: DropPos | null
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (pos: DropPos) => void
  onDrop: (pos: DropPos) => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  onRemoveFromGroup?: () => void
}) {
  const title = run.name?.trim() || formatDateTime(run.startedAt)
  const posFromEvent = (event: React.DragEvent<HTMLDivElement>): DropPos => {
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientY < rect.top + rect.height / 2 ? 'above' : 'below'
  }

  return (
    <div
      className={`card run-card ${dragging ? 'dragging' : ''} ${dropPos ? `drop-${dropPos}` : ''}`}
      draggable={!selecting}
      onDragStart={(e) => {
        e.stopPropagation()
        if (selecting) return
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', `run:${run.id}`)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        onDragOver(posFromEvent(e))
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDrop(posFromEvent(e))
      }}
      onClick={selecting ? onToggle : onOpen}
    >
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 8 }}>
        <span className="run-card-leading">
          {selecting ? (
            <span onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={selected} onChange={onToggle} label={`Select ${title}`} />
            </span>
          ) : (
            <span className="drag-handle" title="Drag to reorder" aria-hidden>
              <GripVertical size={16} />
            </span>
          )}
        </span>
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
      {!selecting && (
        <div className="run-card-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="icon-btn"
            aria-label="Move run up"
            disabled={!canMoveUp}
            onClick={onMoveUp}
          >
            <ChevronUp size={15} />
          </button>
          <button
            className="icon-btn"
            aria-label="Move run down"
            disabled={!canMoveDown}
            onClick={onMoveDown}
          >
            <ChevronDown size={15} />
          </button>
          {containerGroupId != null && onRemoveFromGroup && (
            <button
              className="icon-btn"
              aria-label="Remove from session"
              onClick={onRemoveFromGroup}
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
