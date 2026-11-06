// Live run store. A module-level singleton so navigating away from the live
// screen doesn't interrupt tracking. Every accepted fix is snapshotted to
// localStorage, which is the safety net for a WebView kill.
import { useSyncExternalStore } from 'react'
import { db } from '../db/db'
import type { RunPoint, RunSession } from '../db/types'
import { acceptFix, haversineMeters, RUN_FILTERS } from './geo'
import {
  drainBarometer,
  startBarometer,
  startLocationWatcher,
  stopBarometer,
  type LocationError,
  type LocationFix,
} from './native'
import { nextRunSortOrder } from '../db/runGroups'

export type RunStatus = 'idle' | 'acquiring' | 'running' | 'paused' | 'finished'
export type GpsStatus = 'off' | 'searching' | 'ok' | 'denied' | 'unavailable' | 'timeout'

export interface RunState {
  status: RunStatus
  startedAt: number | null
  /** active time, pauses excluded */
  elapsedSeconds: number
  distanceMeters: number
  points: RunPoint[]
  gpsEnabled: boolean
  gpsStatus: GpsStatus
  accuracy: number | null
  lastFixAt: number | null
}

export interface RunSnapshot extends RunState {
  /** total completed pause time */
  pausedMs: number
  /** start of the current pause, when status === 'paused' */
  pauseStartedAt: number | null
  /** latest barometric altitude, so a resumed run keeps a usable reference */
  baroLatest?: number | null
  /** when this snapshot was written */
  savedAt: number
}

export interface RecoveredRun {
  snapshot: RunSnapshot
  /** true when the snapshot is older than 6 hours */
  stale: boolean
  ageMs: number
}

const STORAGE_KEY = 'clarity.run'
const SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000
/** How long we wait for a first usable fix before offering the manual fallback. */
const GPS_ACQUIRE_TIMEOUT_MS = 25_000
/** Formatting distance to 2 dp must not look like a manual correction. */
const MANUAL_DISTANCE_TOLERANCE_M = 10

const DEFAULT_STATE: RunState = {
  status: 'idle',
  startedAt: null,
  elapsedSeconds: 0,
  distanceMeters: 0,
  points: [],
  gpsEnabled: true,
  gpsStatus: 'off',
  accuracy: null,
  lastFixAt: null,
}

let state: RunState = { ...DEFAULT_STATE }
let pausedMs = 0
let pauseStartedAt: number | null = null
let lastAccepted: RunPoint | null = null
let lastStored: RunPoint | null = null
let ticker: number | null = null
let tickCount = 0
let stopWatcher: (() => void) | null = null
let watcherToken = 0
let acquireTimer: number | null = null

// Barometric altitude, relative to the start of the run. Polled rather than
// pushed: the native layer buffers while the WebView is suspended.
let baroLatest: number | null = null
/** Keeps a resumed run continuous: the native sensor restarts its baseline at 0. */
let baroOffset = 0
let baroTimer: number | null = null
let baroToken = 0
let baroActive = false

const listeners = new Set<() => void>()

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function notify() {
  listeners.forEach((listener) => listener())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getState(): RunState {
  return state
}

export function useRunState(): RunState {
  return useSyncExternalStore(subscribe, getState, getState)
}

function persistSnapshot() {
  if (!hasStorage()) return
  if (state.status === 'idle' || state.startedAt == null) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  const snapshot: RunSnapshot = {
    ...state,
    pausedMs,
    pauseStartedAt,
    baroLatest,
    savedAt: Date.now(),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // A quota error must never stop the run; the worst case is one lost fix.
  }
}

function clearSnapshot() {
  if (hasStorage()) localStorage.removeItem(STORAGE_KEY)
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

function elapsedNow(): number {
  if (state.startedAt == null) return 0
  if (state.status === 'finished') return state.elapsedSeconds
  const end = state.status === 'paused' ? pauseStartedAt ?? Date.now() : Date.now()
  return Math.max(0, (end - state.startedAt - pausedMs) / 1000)
}

function clearTicker() {
  if (ticker != null) {
    window.clearInterval(ticker)
    ticker = null
  }
}

function startTicker() {
  clearTicker()
  tickCount = 0
  ticker = window.setInterval(() => {
    if (state.status !== 'running') return
    const elapsedSeconds = elapsedNow()
    state = { ...state, elapsedSeconds }
    tickCount += 1
    // Persist every few ticks so a kill loses at most a couple of seconds,
    // without writing a growing point array every second.
    if (tickCount % 5 === 0) persistSnapshot()
    notify()
  }, 1000)
}

function stopGps() {
  watcherToken += 1
  stopWatcher?.()
  stopWatcher = null
  clearAcquireTimer()
}

function clearAcquireTimer() {
  if (acquireTimer != null) {
    window.clearTimeout(acquireTimer)
    acquireTimer = null
  }
}

/**
 * Starting with GPS waits for a real fix before the clock starts, so a cold
 * start or a bad sky doesn't burn the first minute of the run. If nothing
 * usable arrives the caller can retry or fall back to manual distance.
 */
function startAcquireTimer() {
  clearAcquireTimer()
  acquireTimer = window.setTimeout(() => {
    acquireTimer = null
    if (state.status !== 'acquiring') return
    stopWatcher?.()
    stopWatcher = null
    state = { ...state, gpsStatus: 'timeout' }
    notify()
  }, GPS_ACQUIRE_TIMEOUT_MS)
}

// ---------------------------------------------------------------- barometer

async function pollBarometer() {
  const readings = await drainBarometer()
  if (readings.length === 0) return
  const latest = readings[readings.length - 1]
  if (Number.isFinite(latest.relativeAltitude)) {
    baroLatest = baroOffset + latest.relativeAltitude
    persistSnapshot()
  }
}

/**
 * Barometric altitude is worth having even without GPS (a treadmill climb, a
 * stairwell with no fix), so tracking follows the run, not the watcher.
 * `resumeFrom` continues the series when a recovered run restarts the sensor.
 */
async function startBarometerTracking(resumeFrom: number | null = null) {
  const token = ++baroToken
  baroOffset = typeof resumeFrom === 'number' && Number.isFinite(resumeFrom) ? resumeFrom : 0
  baroLatest = baroOffset || null
  const available = await startBarometer()
  if (token !== baroToken) {
    void stopBarometer()
    return
  }
  baroActive = available
  if (!available) return
  await pollBarometer()
  if (baroTimer != null) window.clearInterval(baroTimer)
  baroTimer = window.setInterval(() => void pollBarometer(), 2000)
}

function stopBarometerTracking() {
  baroToken += 1
  if (baroTimer != null) {
    window.clearInterval(baroTimer)
    baroTimer = null
  }
  if (baroActive) {
    baroActive = false
    void stopBarometer()
  }
}

function gpsErrorStatus(error: LocationError): GpsStatus {
  const code = error.code.toUpperCase()
  if (code.includes('NOT_AUTHORIZED') || code.includes('PERMISSION')) return 'denied'
  return 'unavailable'
}

async function startGps() {
  const token = ++watcherToken
  stopWatcher?.()
  stopWatcher = null
  state = {
    ...state,
    gpsStatus: state.gpsEnabled ? 'searching' : 'off',
  }
  notify()
  if (!state.gpsEnabled) return
  try {
    const stop = await startLocationWatcher(handleFix, handleGpsError)
    if (token !== watcherToken) {
      stop()
      return
    }
    stopWatcher = stop
  } catch {
    if (token === watcherToken) {
      state = { ...state, gpsStatus: 'unavailable' }
      notify()
    }
  }
}

function handleGpsError(error: LocationError) {
  if (!state.gpsEnabled) return
  const status = gpsErrorStatus(error)
  // A permission error is final for this attempt; let the panel report it
  // instead of the acquisition timeout overwriting the message.
  if (status === 'denied') clearAcquireTimer()
  state = { ...state, gpsStatus: status }
  persistSnapshot()
  notify()
}

/** Keep the stored point array bounded without losing the current position. */
function pushPoint(points: RunPoint[], point: RunPoint) {
  points.push(point)
  if (points.length <= RUN_FILTERS.MAX_POINTS) return
  const kept: RunPoint[] = []
  for (let i = 0; i < points.length; i += 2) kept.push(points[i])
  const last = points[points.length - 1]
  if (kept[kept.length - 1] !== last) kept.push(last)
  points.length = 0
  points.push(...kept)
}

function handleFix(fix: LocationFix, force = false) {
  if (state.status !== 'running' && state.status !== 'acquiring') return
  // A watcher that is being torn down can still deliver one last fix.
  if (!force && !state.gpsEnabled) return

  const point: RunPoint = {
    t: Number.isFinite(fix.timestamp) && fix.timestamp > 0 ? fix.timestamp : Date.now(),
    lat: round6(fix.lat),
    lng: round6(fix.lng),
    acc: fix.accuracy,
    alt: fix.altitude,
    baro: baroLatest,
    spd: fix.speed,
  }

  if (!Number.isFinite(point.acc) || point.acc > RUN_FILTERS.MAX_ACCURACY_M) {
    state = {
      ...state,
      accuracy: Number.isFinite(point.acc) ? point.acc : state.accuracy,
      lastFixAt: point.t,
      gpsStatus: state.gpsEnabled ? 'searching' : 'off',
    }
    notify()
    return
  }

  const decision = acceptFix(lastAccepted, point)
  if (!decision.accepted) {
    state = {
      ...state,
      accuracy: point.acc,
      lastFixAt: point.t,
      gpsStatus:
        state.status === 'acquiring' ? 'searching' : state.gpsEnabled ? 'ok' : 'off',
    }
    notify()
    return
  }

  const points = state.points.slice()
  const shouldStore =
    points.length === 0 ||
    lastStored == null ||
    haversineMeters(lastStored, point) >= RUN_FILTERS.DOWNSAMPLE_M
  if (shouldStore) {
    pushPoint(points, point)
    lastStored = point
  }
  lastAccepted = point

  // The first usable fix ends the wait: the clock starts here, not when the
  // user pressed Start.
  if (state.status === 'acquiring') {
    clearAcquireTimer()
    state = { ...state, status: 'running', startedAt: Date.now(), elapsedSeconds: 0 }
    startTicker()
  }

  state = {
    ...state,
    distanceMeters: state.distanceMeters + (decision.distanceMeters ?? 0),
    points,
    accuracy: point.acc,
    lastFixAt: point.t,
    gpsStatus: state.gpsEnabled ? 'ok' : 'off',
    elapsedSeconds: elapsedNow(),
  }
  persistSnapshot()
  notify()
}

/** Begin a fresh run. Callers should not start over an active session. */
export function startRun({ gps }: { gps: boolean }) {
  stopGps()
  clearTicker()
  pausedMs = 0
  pauseStartedAt = null
  lastAccepted = null
  lastStored = null
  // With GPS the clock waits for a usable fix; without it the run starts now.
  state = {
    ...DEFAULT_STATE,
    status: gps ? 'acquiring' : 'running',
    startedAt: gps ? null : Date.now(),
    gpsEnabled: gps,
    gpsStatus: gps ? 'searching' : 'off',
  }
  persistSnapshot()
  notify()
  if (gps) {
    void startGps()
    startAcquireTimer()
  } else {
    startTicker()
  }
  void startBarometerTracking()
}

/** Try again after the acquisition timed out or permission was fixed. */
export function retryGps() {
  if (state.status !== 'acquiring') return
  state = { ...state, gpsStatus: 'searching', accuracy: null, lastFixAt: null }
  notify()
  void startGps()
  startAcquireTimer()
}

/**
 * Give up on the fix and track time only; the distance is entered when the run
 * is saved (the save dialog already supports a manual correction).
 */
export function startWithoutGps() {
  if (state.status !== 'acquiring') return
  stopGps()
  state = {
    ...state,
    status: 'running',
    startedAt: Date.now(),
    elapsedSeconds: 0,
    gpsEnabled: false,
    gpsStatus: 'off',
    accuracy: null,
  }
  persistSnapshot()
  notify()
  startTicker()
}

export function pauseRun() {
  if (state.status !== 'running') return
  pauseStartedAt = Date.now()
  const elapsedSeconds = elapsedNow()
  stopGps()
  clearTicker()
  // The barometer keeps sampling through a pause so the altitude series stays
  // on one baseline instead of restarting at zero.
  state = {
    ...state,
    status: 'paused',
    elapsedSeconds,
    gpsStatus: 'off',
  }
  persistSnapshot()
  notify()
}

export function resumeRun() {
  if (state.status !== 'paused') return
  if (pauseStartedAt != null) pausedMs += Date.now() - pauseStartedAt
  pauseStartedAt = null
  // The gap must not become a distance jump, so start tracking from the next
  // accepted fix instead of the pre-pause point.
  lastAccepted = null
  state = {
    ...state,
    status: 'running',
    elapsedSeconds: elapsedNow(),
    gpsStatus: state.gpsEnabled ? 'searching' : 'off',
  }
  persistSnapshot()
  notify()
  startTicker()
  if (state.gpsEnabled) void startGps()
}

export function stopRun() {
  if (state.status !== 'running' && state.status !== 'paused') return
  const elapsedSeconds = elapsedNow()
  if (pauseStartedAt != null) {
    pausedMs += Date.now() - pauseStartedAt
    pauseStartedAt = null
  }
  stopGps()
  stopBarometerTracking()
  clearTicker()
  state = {
    ...state,
    status: 'finished',
    elapsedSeconds,
    gpsStatus: 'off',
  }
  persistSnapshot()
  notify()
}

/** Forget the live session and any snapshot. */
export function discardRun() {
  stopGps()
  stopBarometerTracking()
  clearTicker()
  pauseStartedAt = null
  pausedMs = 0
  lastAccepted = null
  lastStored = null
  baroLatest = null
  baroOffset = 0
  state = { ...DEFAULT_STATE }
  clearSnapshot()
  notify()
}

export function setGpsEnabled(enabled: boolean) {
  if (state.status === 'acquiring') {
    if (!enabled) startWithoutGps()
    return
  }
  state = {
    ...state,
    gpsEnabled: enabled,
    gpsStatus: enabled
      ? state.status === 'running'
        ? 'searching'
        : 'off'
      : 'off',
  }
  if (!enabled) stopGps()
  else if (state.status === 'running') void startGps()
  persistSnapshot()
  notify()
}

/**
 * Persist the finished session, then reset the live store. A distance that
 * differs from the GPS track (beyond display rounding) is marked manual.
 */
export async function saveRun({
  distanceMeters,
  notes = '',
  name = '',
}: {
  distanceMeters?: number
  notes?: string
  name?: string
} = {}): Promise<number | null> {
  if (state.startedAt == null) return null

  const gpsDistance = state.distanceMeters
  let distance = gpsDistance
  let isManualDistance = false
  if (distanceMeters != null && Number.isFinite(distanceMeters)) {
    const next = Math.max(0, distanceMeters)
    isManualDistance = Math.abs(next - gpsDistance) > MANUAL_DISTANCE_TOLERANCE_M
    distance = next
  }

  const endedAt = Date.now()
  const sortOrder = await nextRunSortOrder()
  const session: RunSession = {
    name: name.trim(),
    startedAt: state.startedAt,
    endedAt,
    durationSeconds: Math.max(
      0,
      Math.round(state.status === 'finished' ? state.elapsedSeconds : elapsedNow()),
    ),
    distanceMeters: distance,
    isManualDistance,
    points: state.points,
    notes: notes.trim(),
    groupId: null,
    sortOrder,
    createdAt: endedAt,
  }

  const id = (await db.runs.add(session)) as number
  discardRun()
  return id
}

function isValidSnapshot(value: unknown): value is RunSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<RunSnapshot>
  return (
    typeof snapshot.startedAt === 'number' &&
    (snapshot.status === 'running' ||
      snapshot.status === 'paused' ||
      snapshot.status === 'finished') &&
    Array.isArray(snapshot.points)
  )
}

/** Read (but do not adopt) a leftover snapshot; the Runs screen shows a banner. */
export function recoverSnapshot(): RecoveredRun | null {
  if (!hasStorage()) return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isValidSnapshot(parsed)) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    const ageMs = Math.max(0, Date.now() - Number(parsed.savedAt ?? parsed.startedAt))
    return { snapshot: parsed, stale: ageMs > SNAPSHOT_MAX_AGE_MS, ageMs }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

/** Make a recovered snapshot the live session (resume banner → live screen). */
export function adoptSnapshot(snapshot: RunSnapshot) {
  stopGps()
  clearTicker()
  pausedMs = Number(snapshot.pausedMs ?? 0)
  pauseStartedAt = snapshot.status === 'paused' ? snapshot.pauseStartedAt ?? Date.now() : null
  state = {
    ...DEFAULT_STATE,
    status: snapshot.status,
    startedAt: snapshot.startedAt,
    elapsedSeconds: Number(snapshot.elapsedSeconds ?? 0),
    distanceMeters: Number(snapshot.distanceMeters ?? 0),
    points: Array.isArray(snapshot.points) ? snapshot.points : [],
    gpsEnabled: Boolean(snapshot.gpsEnabled),
    gpsStatus: snapshot.gpsEnabled
      ? snapshot.status === 'paused' || snapshot.status === 'finished'
        ? 'off'
        : 'searching'
      : 'off',
    accuracy: snapshot.accuracy ?? null,
    lastFixAt: snapshot.lastFixAt ?? null,
  }
  const last = state.points[state.points.length - 1] ?? null
  lastStored = last
  lastAccepted = last
  if (state.status !== 'finished') state = { ...state, elapsedSeconds: elapsedNow() }
  persistSnapshot()
  notify()
  if (state.status === 'running') {
    startTicker()
    if (state.gpsEnabled) void startGps()
    const restored = typeof snapshot.baroLatest === 'number' ? snapshot.baroLatest : null
    void startBarometerTracking(restored)
  }
}

/** Save a stale/abandoned snapshot as a run, then clear it. */
export async function saveRecoveredRun(notes = ''): Promise<number | null> {
  const recovered = recoverSnapshot()
  if (!recovered) return null
  const { snapshot } = recovered
  if (snapshot.startedAt == null) return null
  const session: RunSession = {
    startedAt: snapshot.startedAt,
    endedAt: snapshot.savedAt,
    durationSeconds: Math.max(0, Math.round(snapshot.elapsedSeconds ?? 0)),
    distanceMeters: Math.max(0, Number(snapshot.distanceMeters ?? 0)),
    isManualDistance: false,
    points: Array.isArray(snapshot.points) ? snapshot.points : [],
    notes: notes.trim(),
    groupId: null,
    sortOrder: await nextRunSortOrder(),
    createdAt: Date.now(),
  }
  const id = (await db.runs.add(session)) as number
  discardRun()
  return id
}

/**
 * DEV helper: feed synthetic fixes through the same filter/downsample path as
 * real GPS so the whole flow can be exercised without leaving the desk.
 */
export function simulateRun(distanceMeters = 5000) {
  if (state.status === 'finished') return
  if (state.status === 'paused') resumeRun()
  if (state.startedAt == null) {
    const durationMs = (distanceMeters / 1000) * 5 * 60 * 1000 // 5:00 /km
    startRun({ gps: false })
    state = { ...state, startedAt: Date.now() - durationMs, gpsStatus: 'off' }
  }

  const total = Math.max(100, distanceMeters)
  const steps = Math.max(2, Math.min(1200, Math.round(total / 25)))
  const stepDistance = total / (steps - 1)
  const existing = state.points[state.points.length - 1]
  let lat = existing?.lat ?? 19.076
  let lng = existing?.lng ?? 72.8777
  let timestamp = existing?.t ?? state.startedAt ?? Date.now()
  // 5:00 /km keeps synthetic split times consistent with the backdated clock.
  const speed = 1000 / 300
  let bearing = 45

  handleFix({ lat, lng, accuracy: 5, altitude: null, speed, timestamp }, true)
  for (let i = 1; i < steps; i += 1) {
    bearing += 9
    const radians = (bearing * Math.PI) / 180
    lat += (stepDistance * Math.cos(radians)) / 111_320
    lng +=
      (stepDistance * Math.sin(radians)) /
      (111_320 * Math.cos((lat * Math.PI) / 180))
    timestamp += Math.round((stepDistance / speed) * 1000)
    handleFix({ lat, lng, accuracy: 5, altitude: null, speed, timestamp }, true)
  }

  state = { ...state, elapsedSeconds: elapsedNow(), gpsStatus: 'off' }
  persistSnapshot()
  notify()
}
