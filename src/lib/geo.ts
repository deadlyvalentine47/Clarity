// Pure distance/pace helpers for the Runs feature. No DOM access so the
// functions can be exercised straight from the smoke logic script.
import type { DistanceUnit, RunPoint } from '../db/types'

export const KM_PER_MILE = 1.609344
export const METERS_PER_KILOMETER = 1000
export const METERS_PER_MILE = KM_PER_MILE * METERS_PER_KILOMETER

/**
 * Tunable GPS filters. A fix is only counted when it is accurate enough,
 * moves far enough to beat jitter, and does not imply an impossible speed.
 */
export const RUN_FILTERS = {
  MAX_ACCURACY_M: 25,
  MAX_SPEED_MPS: 12,
  MIN_MOVE_M: 2.5,
  DOWNSAMPLE_M: 5,
  MAX_POINTS: 5000,
} as const

const EARTH_RADIUS_M = 6_371_000

type LatLng = Pick<RunPoint, 'lat' | 'lng'>

const toRad = (degrees: number) => (degrees * Math.PI) / 180

/** Great-circle distance in metres between two coordinates. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function metersPerUnit(unit: DistanceUnit): number {
  return unit === 'mi' ? METERS_PER_MILE : METERS_PER_KILOMETER
}

export function metersToUnit(meters: number, unit: DistanceUnit): number {
  return meters / metersPerUnit(unit)
}

export function distanceLabel(meters: number, unit: DistanceUnit): string {
  const value = metersToUnit(Number.isFinite(meters) ? meters : 0, unit)
  return `${value.toFixed(2)} ${unit}`
}

/** "42:19" below an hour, "1:02:44" from one hour up. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(Number.isFinite(totalSeconds) ? totalSeconds : 0))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Format an already-computed seconds-per-unit pace, e.g. "5:12 /km". */
export function formatPaceValue(secondsPerUnit: number, unit: DistanceUnit): string {
  if (
    !Number.isFinite(secondsPerUnit) ||
    secondsPerUnit <= 0 ||
    secondsPerUnit > 3600
  ) {
    return '—'
  }
  const total = Math.round(secondsPerUnit)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')} /${unit}`
}

/** Average pace for a distance/time pair; too little distance reads "—". */
export function formatPace(seconds: number, meters: number, unit: DistanceUnit): string {
  if (!Number.isFinite(seconds) || !Number.isFinite(meters) || meters < 20) return '—'
  return formatPaceValue(seconds / metersToUnit(meters, unit), unit)
}

export type FixRejectReason = 'accuracy' | 'speed' | 'jitter'

export interface FixDecision {
  accepted: boolean
  reason?: FixRejectReason
  /** distance from the previous accepted fix, when accepted */
  distanceMeters?: number
}

export interface FixLike extends LatLng {
  /** epoch ms */
  t: number
  /** horizontal accuracy in metres */
  acc: number
}

/**
 * Decide whether a raw fix may extend the track. `prev` is the last accepted
 * fix (null at the start of a run). Pure and deterministic.
 */
export function acceptFix(prev: FixLike | null | undefined, fix: FixLike): FixDecision {
  if (!Number.isFinite(fix.acc) || fix.acc > RUN_FILTERS.MAX_ACCURACY_M) {
    return { accepted: false, reason: 'accuracy' }
  }
  if (!prev) return { accepted: true, distanceMeters: 0 }

  const distanceMeters = haversineMeters(prev, fix)
  const dt = (fix.t - prev.t) / 1000
  if (dt <= 0) return { accepted: false, reason: 'jitter' }
  if (distanceMeters < RUN_FILTERS.MIN_MOVE_M) return { accepted: false, reason: 'jitter' }
  if (distanceMeters / dt > RUN_FILTERS.MAX_SPEED_MPS) {
    return { accepted: false, reason: 'speed' }
  }
  return { accepted: true, distanceMeters }
}

export interface RunSplit {
  /** 1-based split number */
  index: number
  /** seconds spent in this split */
  seconds: number
  /** split length in metres (one km or one mile) */
  distanceMeters: number
  /** seconds from the start of the run to the end of this split */
  cumulativeSeconds: number
}

/**
 * Derive per-unit splits from the stored points. Splits are never persisted,
 * so a run's detail screen always recalculates from the same track.
 */
export function splitSeconds(points: RunPoint[], unit: DistanceUnit = 'km'): RunSplit[] {
  if (points.length < 2) return []
  const target = metersPerUnit(unit)
  const splits: RunSplit[] = []
  let sinceSplit = 0
  let splitStart = points[0].t

  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1]
    const to = points[i]
    const segmentMeters = haversineMeters(from, to)
    if (segmentMeters <= 0) continue

    let travelled = 0

    while (sinceSplit + (segmentMeters - travelled) >= target) {
      const need = target - sinceSplit
      const fraction = (travelled + need) / segmentMeters
      const crossing = from.t + fraction * (to.t - from.t)
      const seconds = Math.max(0, Math.round((crossing - splitStart) / 1000))
      splits.push({
        index: splits.length + 1,
        seconds,
        distanceMeters: target,
        cumulativeSeconds: Math.max(0, Math.round((crossing - points[0].t) / 1000)),
      })
      travelled += need
      sinceSplit = 0
      splitStart = crossing
    }

    sinceSplit += segmentMeters - travelled
  }

  return splits
}
