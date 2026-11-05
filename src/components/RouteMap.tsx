import type { RunPoint } from '../db/types'

const VIEW = 100
const PADDING = 6
const MAX_RENDER_POINTS = 400

interface XY {
  x: number
  y: number
}

/**
 * Project points for a compact offline route drawing. Longitude is scaled by
 * cos(latitude) so a north-south and an east-west leg of equal length look the
 * same, then the track is fitted into a 0–100 viewBox.
 */
function project(points: RunPoint[]): XY[] {
  if (points.length < 2) return []
  const meanLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length
  const lngScale = Math.cos((meanLat * Math.PI) / 180) || 1

  const raw = points.map((point) => ({ x: point.lng * lngScale, y: -point.lat }))
  const xs = raw.map((point) => point.x)
  const ys = raw.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = maxX - minX
  const height = maxY - minY
  const span = VIEW - PADDING * 2
  const scale =
    width === 0 && height === 0
      ? 0
      : Math.min(width > 0 ? span / width : Infinity, height > 0 ? span / height : Infinity)

  const offsetX = (VIEW - width * scale) / 2
  const offsetY = (VIEW - height * scale) / 2

  return raw.map((point) => ({
    x: width > 0 ? offsetX + (point.x - minX) * scale : VIEW / 2,
    y: height > 0 ? offsetY + (point.y - minY) * scale : VIEW / 2,
  }))
}

function downsample(points: RunPoint[]): RunPoint[] {
  if (points.length <= MAX_RENDER_POINTS) return points
  const step = Math.ceil(points.length / MAX_RENDER_POINTS)
  const kept: RunPoint[] = []
  for (let i = 0; i < points.length; i += step) kept.push(points[i])
  const last = points[points.length - 1]
  if (kept[kept.length - 1] !== last) kept.push(last)
  return kept
}

export default function RouteMap({
  points,
  compact = false,
}: {
  points: RunPoint[]
  compact?: boolean
}) {
  const rendered = project(downsample(points ?? []))
  const start = rendered[0]
  const end = rendered[rendered.length - 1]

  if (rendered.length < 2 || !start || !end) {
    return (
      <div className={`route-map ${compact ? 'compact' : ''}`}>
        <div className="route-map-empty">No route recorded</div>
      </div>
    )
  }

  const path = rendered.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
  const zoom = compact ? 14 : 6

  return (
    <div className={`route-map ${compact ? 'compact' : ''}`}>
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        role="img"
        aria-label="Run route"
        preserveAspectRatio="xMidYMid meet"
      >
        <polyline
          points={path}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={start.x} cy={start.y} r={zoom / 2} fill="var(--success)" />
        <circle cx={end.x} cy={end.y} r={zoom / 2} fill="var(--error)" />
      </svg>
    </div>
  )
}
