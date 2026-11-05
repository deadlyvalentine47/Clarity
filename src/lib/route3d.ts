// Pure helpers for the 3D route renderer. No DOM access: the projection maths
// and altitude summaries are testable from the smoke logic script.
import type { RunPoint } from '../db/types'
import { haversineMeters } from './geo'

const METERS_PER_DEGREE_LAT = 111_320
/**
 * Altitude changes below this are noise, not terrain. A pressure sensor is
 * accurate to ~0.1 m, so the barometer can resolve gentle rollers that GNSS
 * altitude would swallow.
 */
const ELEVATION_NOISE_M = 1.5
const BAROMETER_NOISE_M = 0.5

export interface Point3 {
  /** metres east of the first point */
  east: number
  /** metres north of the first point */
  north: number
  /** metres above the lowest sampled altitude, already exaggerated */
  up: number
}

export interface AltitudeStats {
  min: number
  max: number
  gain: number
  loss: number
  samples: number
}

export type AltitudeSource = 'barometer' | 'gps'

function barometricAltitude(point: RunPoint): number | null {
  return typeof point.baro === 'number' && Number.isFinite(point.baro) ? point.baro : null
}

function gnssAltitude(point: RunPoint): number | null {
  return typeof point.alt === 'number' && Number.isFinite(point.alt) ? point.alt : null
}

/**
 * One altitude series for the whole track. Barometric readings are relative to
 * the start of the run while GNSS readings are absolute, so mixing them point
 * by point would invent a cliff — the source is picked once for the track.
 */
export function altitudeSource(points: RunPoint[]): AltitudeSource | null {
  if (points.length === 0) return null
  let barometer = 0
  let gps = 0
  for (const point of points) {
    if (barometricAltitude(point) != null) barometer += 1
    else if (gnssAltitude(point) != null) gps += 1
  }
  if (barometer / points.length >= 0.5) return 'barometer'
  if (gps / points.length >= 0.5) return 'gps'
  return null
}

function altitudeOf(point: RunPoint, source: AltitudeSource): number | null {
  return source === 'barometer' ? barometricAltitude(point) : gnssAltitude(point)
}

/** True when most points carry a usable altitude sample. */
export function hasAltitude(points: RunPoint[]): boolean {
  return altitudeSource(points) != null
}

/** Moving average over the altitude samples that exist. */
export function smoothAltitudes(points: RunPoint[], window = 5): (number | null)[] {
  const source = altitudeSource(points)
  const values = points.map((point) => (source ? altitudeOf(point, source) : null))
  const half = Math.max(1, Math.floor(window / 2))
  return values.map((value, index) => {
    if (value == null) return null
    let sum = 0
    let count = 0
    for (let i = index - half; i <= index + half; i += 1) {
      const other = values[i]
      if (other == null) continue
      sum += other
      count += 1
    }
    return count > 0 ? sum / count : value
  })
}

/**
 * Convert the track into local metres. Longitude is scaled by cos(latitude) so
 * equal-length legs stay equal length; altitude is offset to the lowest point.
 */
export function toLocalMeters(points: RunPoint[], verticalScale = 1): Point3[] {
  if (points.length === 0) return []
  const origin = points[0]
  const lngScale = Math.cos((origin.lat * Math.PI) / 180) || 1
  const altitudes = smoothAltitudes(points)
  const known = altitudes.filter((value): value is number => value != null)
  const base = known.length > 0 ? Math.min(...known) : 0
  let lastKnown = known.length > 0 ? known[0] : 0

  return points.map((point, index) => {
    const altitude = altitudes[index]
    if (altitude != null) lastKnown = altitude
    return {
      east: (point.lng - origin.lng) * METERS_PER_DEGREE_LAT * lngScale,
      north: (point.lat - origin.lat) * METERS_PER_DEGREE_LAT,
      up: (lastKnown - base) * verticalScale,
    }
  })
}

/** Altitude range and gain/loss, ignoring sub-noise wobble. */
export function altitudeStats(points: RunPoint[]): AltitudeStats | null {
  const values = smoothAltitudes(points).filter((value): value is number => value != null)
  if (values.length < 2) return null

  const noise = altitudeSource(points) === 'barometer' ? BAROMETER_NOISE_M : ELEVATION_NOISE_M
  let min = values[0]
  let max = values[0]
  let gain = 0
  let loss = 0
  // Compare against the last accepted altitude, not the previous sample: a
  // sustained 3 m-per-floor descent moves less than the noise threshold per
  // sample and would otherwise never register.
  let anchor = values[0]

  for (let i = 1; i < values.length; i += 1) {
    const delta = values[i] - anchor
    if (delta > noise) {
      gain += delta
      anchor = values[i]
    } else if (delta < -noise) {
      loss -= delta
      anchor = values[i]
    }
    if (values[i] < min) min = values[i]
    if (values[i] > max) max = values[i]
  }

  return { min, max, gain, loss, samples: values.length }
}

export interface ElevationSample {
  /** metres from the start of the run */
  distanceMeters: number
  altitudeMeters: number
}

/**
 * Distance/altitude pairs along the track. Distance uses the same horizontal
 * measure as the run total, so the profile's x-axis matches the reported
 * distance instead of the slightly longer path over the ground.
 */
export function elevationProfile(points: RunPoint[]): ElevationSample[] {
  if (points.length < 2 || altitudeSource(points) == null) return []

  const altitudes = smoothAltitudes(points)
  const samples: ElevationSample[] = []
  let distance = 0

  for (let i = 0; i < points.length; i += 1) {
    if (i > 0) distance += haversineMeters(points[i - 1], points[i])
    const altitude = altitudes[i]
    if (altitude == null) continue
    samples.push({ distanceMeters: distance, altitudeMeters: altitude })
  }

  return samples
}

/**
 * Oblique projection. `yaw` spins the track around the vertical axis; `tilt` is
 * 0 for a straight-on side view and π/2 for a flat top-down view. Positive
 * altitude moves a point further up the screen (smaller y).
 */
export function projectPoint(point: Point3, yaw: number, tilt: number) {
  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)
  return {
    x: point.east * cosYaw - point.north * sinYaw,
    y: (point.east * sinYaw + point.north * cosYaw) * Math.sin(tilt) - point.up * Math.cos(tilt),
  }
}
