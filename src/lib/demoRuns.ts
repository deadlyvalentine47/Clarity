// Demo run fixtures for eyeballing the 3D map and elevation profile.
//
// Dev-only: RunsScreen loads this with a dynamic import behind
// `import.meta.env.DEV`, so it never reaches the production bundle. Seeding is
// additive and idempotent — it only inserts fixtures whose notes it has not
// seen, so repeated taps do not duplicate anything and real runs are untouched.
import { db } from '../db/db'
import type { RunPoint, RunSession } from '../db/types'

const ORIGIN = { lat: 19.076, lng: 72.8777 }
const METERS_PER_DEGREE_LAT = 111_320
const LNG_SCALE = Math.cos((ORIGIN.lat * Math.PI) / 180) || 1
const DAY = 86_400_000
/** 5:30 /km, a plausible easy pace. */
const SECONDS_PER_METRE = 0.33

export const DEMO_PREFIX = 'Demo · '

interface Sample {
  /** metres east of the origin */
  x: number
  /** metres north of the origin */
  y: number
  /** metres above sea level */
  alt: number
}

function round(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function runFromSamples(
  name: string,
  samples: Sample[],
  startedAt: number,
  overrides: Partial<RunSession> = {},
): RunSession {
  const baseAltitude = samples[0]?.alt ?? 0
  const points: RunPoint[] = []
  let timestamp = startedAt
  let distance = 0

  samples.forEach((sample, index) => {
    if (index > 0) {
      const previous = samples[index - 1]
      const step = Math.hypot(sample.x - previous.x, sample.y - previous.y)
      distance += step
      timestamp += Math.round(step * SECONDS_PER_METRE * 1000)
    }
    points.push({
      t: timestamp,
      lat: round(ORIGIN.lat + sample.y / METERS_PER_DEGREE_LAT, 6),
      lng: round(ORIGIN.lng + sample.x / (METERS_PER_DEGREE_LAT * LNG_SCALE), 6),
      acc: 5,
      alt: round(sample.alt, 2),
      baro: round(sample.alt - baseAltitude, 2),
      spd: round(1 / SECONDS_PER_METRE, 2),
    })
  })

  return {
    name,
    startedAt,
    endedAt: timestamp,
    durationSeconds: Math.max(1, Math.round((timestamp - startedAt) / 1000)),
    distanceMeters: Math.round(distance),
    isManualDistance: false,
    points,
    notes: DEMO_PREFIX + name,
    createdAt: timestamp,
    ...overrides,
  }
}

/** 10 km out-and-back road: gradual 45 m climb, 25 m descent, then a rise. */
function rollingRoad(): Sample[] {
  const samples: Sample[] = []
  const count = 1000
  for (let i = 0; i <= count; i += 1) {
    const distance = (i / count) * 10_000
    const climb =
      distance <= 4000
        ? (45 * distance) / 4000
        : distance <= 8000
          ? 45 - (25 * (distance - 4000)) / 4000
          : 20 + (10 * (distance - 8000)) / 2000
    samples.push({
      x: distance,
      y: 90 * Math.sin(distance / 2200),
      alt: 120 + climb + 2.5 * Math.sin(distance / 260),
    })
  }
  return samples
}

function loop(radius: number, laps: number, altitude: (theta: number) => number): Sample[] {
  const samples: Sample[] = []
  const circumference = 2 * Math.PI * radius * laps
  const count = Math.max(80, Math.round(circumference / 5))
  for (let i = 0; i <= count; i += 1) {
    const theta = (i / count) * Math.PI * 2 * laps
    samples.push({
      x: radius * Math.cos(theta),
      y: radius * Math.sin(theta),
      alt: altitude(theta),
    })
  }
  return samples
}

/** Five floors up in a switchback stairwell, then back down. */
function stairs(): Sample[] {
  const samples: Sample[] = []
  let x = 0
  let y = 0
  const push = (alt: number) => samples.push({ x, y, alt })

  for (let i = 0; i < 12; i += 1) {
    x += 3
    push(30)
  }
  for (let i = 1; i <= 40; i += 1) {
    x += 0.5
    y += i % 2 === 0 ? 0.9 : -0.9
    push(30 + (15 * i) / 40)
  }
  for (let i = 0; i < 5; i += 1) {
    x += 2
    push(45)
  }
  for (let i = 1; i <= 40; i += 1) {
    x += 0.5
    y += i % 2 === 0 ? -0.9 : 0.9
    push(45 - (15 * i) / 40)
  }
  return samples
}

/** 3 km road that snakes side to side while climbing 25 m. */
function sCurve(): Sample[] {
  const samples: Sample[] = []
  const count = 600
  for (let i = 0; i <= count; i += 1) {
    const distance = (i / count) * 3000
    samples.push({
      x: distance,
      y: 150 * Math.sin(distance / 250),
      alt: 80 + (25 * distance) / 3000 + 4 * Math.sin(distance / 180),
    })
  }
  return samples
}

/** 3 x 400 m hill repeats: 25 m up, 25 m down each time. */
function hillRepeats(): Sample[] {
  const samples: Sample[] = []
  let x = 0
  const push = (alt: number) => samples.push({ x, y: 0, alt })
  push(60)
  for (let rep = 0; rep < 3; rep += 1) {
    for (let i = 1; i <= 80; i += 1) {
      x += 5
      push(60 + (25 * i) / 80)
    }
    for (let i = 1; i <= 80; i += 1) {
      x += 5
      push(85 - (25 * i) / 80)
    }
  }
  return samples
}

/** Flat 2 km out-and-back with realistic lateral GPS jitter. */
function noisyOutAndBack(): Sample[] {
  const samples: Sample[] = []
  const count = 400
  const noise = (seed: number) => {
    const value = Math.sin(seed * 12.9898) * 43758.5453
    return (value - Math.floor(value)) * 2 - 1
  }
  for (let i = 0; i <= count; i += 1) {
    const outward = i <= count / 2
    const progress = outward ? i : count - i
    samples.push({
      x: (progress / (count / 2)) * 2000,
      y: noise(i) * 2.5,
      alt: 100 + noise(i + 7) * 1.2,
    })
  }
  return samples
}

function buildSpecs(now: number): RunSession[] {
  const treadmill: RunSession = {
    name: 'Treadmill',
    startedAt: now - 7 * DAY,
    endedAt: now - 7 * DAY + 1_800_000,
    durationSeconds: 1800,
    distanceMeters: 5000,
    isManualDistance: true,
    points: [],
    notes: `${DEMO_PREFIX}Treadmill (manual distance)`,
    createdAt: now - 7 * DAY,
  }

  return [
    runFromSamples('10 km rolling road', rollingRoad(), now - DAY),
    runFromSamples('1.6 km flat loop', loop(250, 2, () => 12), now - 2 * DAY),
    runFromSamples('5 floors up and down', stairs(), now - 3 * DAY),
    runFromSamples(
      '3 km hill loop',
      loop(480, 1, (theta) => 30 + 15 * Math.sin(theta)),
      now - 4 * DAY,
    ),
    runFromSamples('S-curve road with hills', sCurve(), now - 5 * DAY),
    runFromSamples('3 x hill repeats', hillRepeats(), now - 6 * DAY),
    runFromSamples('Noisy out and back', noisyOutAndBack(), now - 8 * DAY),
    treadmill,
  ]
}

export interface SeedResult {
  added: number
  skipped: number
  total: number
}

/** Insert any missing demo runs. Existing runs are never modified or removed. */
export async function seedDemoRuns(): Promise<SeedResult> {
  const specs = buildSpecs(Date.now())
  const existing = await db.runs.toArray()
  const known = new Set(existing.map((run) => run.notes))

  let added = 0
  let skipped = 0
  for (const spec of specs) {
    if (known.has(spec.notes)) {
      skipped += 1
      continue
    }
    const { points, ...row } = spec
    const runId = (await db.runs.add(row)) as number
    if (points && points.length > 0) await db.runTracks.put({ runId, points })
    added += 1
  }

  return { added, skipped, total: specs.length }
}

/** Remove only the demo fixtures. Real runs are left alone. */
export async function clearDemoRuns(): Promise<number> {
  const demo = (await db.runs.toArray()).filter((run) => run.notes.startsWith(DEMO_PREFIX))
  const ids = demo.map((run) => run.id).filter((id): id is number => id != null)
  if (ids.length > 0) {
    await db.transaction('rw', db.runs, db.runTracks, async () => {
      await db.runs.bulkDelete(ids)
      await db.runTracks.bulkDelete(ids)
    })
  }
  return ids.length
}
