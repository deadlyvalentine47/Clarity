import { useMemo } from 'react'
import type { DistanceUnit, RunPoint } from '../db/types'
import { distanceLabel, metersToUnit } from '../lib/geo'
import { elevationProfile, type ElevationSample } from '../lib/route3d'

const VIEW_W = 100
const VIEW_H = 38
const PAD_X = 1
const PAD_TOP = 4
const PAD_BOTTOM = 4
const MAX_SAMPLES = 240

interface ProfileModel {
  line: string
  area: string
  min: number
  max: number
  totalMeters: number
  gridlines: number[]
  baseline: number
}

/**
 * Distance-versus-altitude chart. A 10 km road run with 40 m of climb is far
 * too wide to read in the 3D route view, so the elevation gets its own axis.
 */
export default function ElevationProfile({
  points,
  unit,
}: {
  points: RunPoint[]
  unit: DistanceUnit
}) {
  const model = useMemo<ProfileModel | null>(() => {
    const samples = elevationProfile(points)
    if (samples.length < 2) return null

    const step = Math.max(1, Math.ceil(samples.length / MAX_SAMPLES))
    const reduced: ElevationSample[] = []
    for (let i = 0; i < samples.length; i += step) reduced.push(samples[i])
    const last = samples[samples.length - 1]
    if (reduced[reduced.length - 1] !== last) reduced.push(last)

    const totalMeters = last.distanceMeters || 1
    const min = Math.min(...samples.map((sample) => sample.altitudeMeters))
    const max = Math.max(...samples.map((sample) => sample.altitudeMeters))
    const span = max - min || 1
    const plotW = VIEW_W - PAD_X * 2
    const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM
    const baseline = PAD_TOP + plotH

    const coords = reduced.map((sample) => ({
      x: PAD_X + (sample.distanceMeters / totalMeters) * plotW,
      y: PAD_TOP + (1 - (sample.altitudeMeters - min) / span) * plotH,
    }))

    const line = coords.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
    const area = `${PAD_X},${baseline} ${line} ${(PAD_X + plotW).toFixed(2)},${baseline}`

    return {
      line,
      area,
      min,
      max,
      totalMeters,
      baseline,
      gridlines: [0.25, 0.5, 0.75].map((fraction) => PAD_TOP + fraction * plotH),
    }
  }, [points])

  if (!model) return null

  const totalLabel = `${metersToUnit(model.totalMeters, unit).toFixed(2)} ${unit}`

  return (
    <div className="elevation-profile">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Elevation profile from ${Math.round(model.min)} to ${Math.round(model.max)} metres over ${distanceLabel(model.totalMeters, unit)}`}
      >
        {model.gridlines.map((y) => (
          <line
            key={y}
            x1={PAD_X}
            y1={y}
            x2={VIEW_W - PAD_X}
            y2={y}
            stroke="var(--outline)"
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polygon points={model.area} fill="var(--primary)" opacity="0.2" />
        <polyline
          points={model.line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={PAD_X}
          y1={model.baseline}
          x2={VIEW_W - PAD_X}
          y2={model.baseline}
          stroke="var(--outline)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="elevation-axis tiny muted">
        <span>
          {Math.round(model.min)}–{Math.round(model.max)} m
        </span>
        <span>{totalLabel}</span>
      </div>
    </div>
  )
}
