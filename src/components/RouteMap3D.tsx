import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { RunPoint } from '../db/types'
import { isClosedLoop } from '../lib/geo'
import { altitudeStats, hasAltitude, projectPoint, toLocalMeters, type Point3 } from '../lib/route3d'
import LoopBadge from './LoopBadge'
import { Segmented } from './ui'

const VIEW = 100
const PADDING = 8
const MAX_RENDER_POINTS = 600
const DEFAULT_YAW = -0.7
const DEFAULT_TILT = 0.8
const VERTICAL_SCALES = [1, 5, 20, 50] as const
/** Chronological chunks: faint for the first lap, solid for the last. */
const CHUNK_COUNT = 8
const CHUNK_OPACITY = [0.28, 0.36, 0.44, 0.54, 0.64, 0.75, 0.88, 1]
/** Altitude colour bands, low to high. */
const BUCKET_COUNT = 5
const MAX_BANDS = 6
const MAX_ZOOM = 10
const MAX_SEGMENTS = 300

interface XY {
  x: number
  y: number
}

interface Band {
  points: string
  label: string
  anchor: XY
}

interface RouteSegment {
  key: string
  bucket: number
  opacity: number
  points: string
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

function svgPath(points: XY[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Round altitude step so a track shows a handful of readable level lines. */
function bandStep(maxHeight: number): number {
  if (!Number.isFinite(maxHeight) || maxHeight <= 0) return 1
  for (const candidate of [1, 2, 3, 5, 10, 20, 25, 50, 100]) {
    if (maxHeight / candidate <= MAX_BANDS) return candidate
  }
  return 100
}

/** Exaggeration that keeps the descent legible against a wide ground footprint. */
function suggestedVerticalScale(points: RunPoint[]): number {
  if (points.length < 2) return 5
  const local = toLocalMeters(points, 1)
  const height = Math.max(...local.map((point) => point.up))
  if (height < 2) return 1
  const easts = local.map((point) => point.east)
  const norths = local.map((point) => point.north)
  const footprint = Math.hypot(
    Math.max(...easts) - Math.min(...easts),
    Math.max(...norths) - Math.min(...norths),
  )
  // Aim for the climb to fill about a quarter of the frame. A 10 km road run
  // with 40 m of hills needs a much bigger multiplier than a stairwell does.
  const target = (footprint / height) * 0.25
  let scale = 1
  for (const option of VERTICAL_SCALES) {
    if (option <= target) scale = option
  }
  return scale
}

/**
 * Oblique 3D view of a recorded track. Height comes from the altitude stored on
 * each point, which is what separates a rooftop leg from the stairwell below
 * it — in a flat 2D projection they overlap and the route reads as a knot.
 */
export default function RouteMap3D({ points }: { points: RunPoint[] }) {
  const usable = useMemo(
    () => (Array.isArray(points) && hasAltitude(points) ? downsample(points) : []),
    [points],
  )
  const stats = useMemo(() => altitudeStats(usable), [usable])

  const [yaw, setYaw] = useState(DEFAULT_YAW)
  const [tilt, setTilt] = useState(DEFAULT_TILT)
  const [verticalScale, setVerticalScale] = useState<number>(() => suggestedVerticalScale(usable))
  const [camera, setCamera] = useState({ zoom: 1, panX: 0, panY: 0 })

  const svgRef = useRef<SVGSVGElement | null>(null)
  const drag = useRef<{ x: number; y: number; yaw: number; tilt: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; midX: number; midY: number } | null>(null)

  const zoomBy = useCallback(
    (
      factor: number,
      anchor?: { clientX: number; clientY: number },
      panDelta?: { x: number; y: number },
    ) => {
      const svg = svgRef.current
      let anchorX = VIEW / 2
      let anchorY = VIEW / 2
      let unitPerPixel = 1
      if (svg) {
        const ctm = svg.getScreenCTM()
        if (ctm) {
          unitPerPixel = ctm.a || 1
          if (anchor) {
            const point = svg.createSVGPoint()
            point.x = anchor.clientX
            point.y = anchor.clientY
            const local = point.matrixTransform(ctm.inverse())
            anchorX = local.x
            anchorY = local.y
          }
        }
      }
      setCamera((current) => {
        const nextZoom = clamp(current.zoom * factor, 1, MAX_ZOOM)
        if (nextZoom <= 1.001) return { zoom: 1, panX: 0, panY: 0 }
        const ratio = nextZoom / current.zoom
        const panX =
          anchorX - VIEW / 2 - (anchorX - VIEW / 2 - current.panX) * ratio +
          (panDelta ? panDelta.x / unitPerPixel : 0)
        const panY =
          anchorY - VIEW / 2 - (anchorY - VIEW / 2 - current.panY) * ratio +
          (panDelta ? panDelta.y / unitPerPixel : 0)
        return { zoom: nextZoom, panX, panY }
      })
    },
    [],
  )

  // React registers wheel handlers as passive, so preventDefault needs a
  // native listener to stop the page scrolling while zooming the map.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoomBy(Math.exp(-event.deltaY * 0.0015), {
        clientX: event.clientX,
        clientY: event.clientY,
      })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [zoomBy])

  const geometry = useMemo(() => {
    if (usable.length < 2) return null

    const local = toLocalMeters(usable, verticalScale)
    const onGround = (point: Point3) => projectPoint({ ...point, up: 0 }, yaw, tilt)
    const projected = local.map((point) => projectPoint(point, yaw, tilt))
    const shadow = local.map(onGround)

    const easts = local.map((point) => point.east)
    const norths = local.map((point) => point.north)
    const minEast = Math.min(...easts)
    const maxEast = Math.max(...easts)
    const minNorth = Math.min(...norths)
    const maxNorth = Math.max(...norths)
    const maxUp = Math.max(...local.map((point) => point.up), 0)
    const realHeight = maxUp / verticalScale

    const corners = [
      { east: minEast, north: minNorth, up: 0 },
      { east: maxEast, north: minNorth, up: 0 },
      { east: maxEast, north: maxNorth, up: 0 },
      { east: minEast, north: maxNorth, up: 0 },
    ].map(onGround)

    const all = [...projected, ...corners]
    const xs = all.map((point) => point.x)
    const ys = all.map((point) => point.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const width = maxX - minX
    const height = maxY - minY
    const span = VIEW - PADDING * 2
    const fit = Math.min(
      width > 0 ? span / width : Number.POSITIVE_INFINITY,
      height > 0 ? span / height : Number.POSITIVE_INFINITY,
    )
    const scale = Number.isFinite(fit) && fit > 0 ? fit : 1
    const offsetX = (VIEW - width * scale) / 2 - minX * scale
    const offsetY = (VIEW - height * scale) / 2 - minY * scale
    const toScreen = (point: XY): XY => ({
      x: point.x * scale + offsetX,
      y: point.y * scale + offsetY,
    })

    const screen = projected.map(toScreen)
    const bucketOf = (index: number) => {
      if (realHeight <= 0) return 0
      const metres = local[index].up / verticalScale
      return clamp(Math.floor((metres / realHeight) * BUCKET_COUNT), 0, BUCKET_COUNT - 1)
    }
    const chunkOf = (index: number) => {
      const chunkSize = Math.max(1, Math.ceil((screen.length - 1) / CHUNK_COUNT))
      return Math.min(CHUNK_COUNT - 1, Math.floor(index / chunkSize))
    }

    const segments: RouteSegment[] = []
    let collapseChunks = false
    for (let i = 1; i < screen.length; i += 1) {
      const bucket = bucketOf(i - 1)
      const chunk = collapseChunks ? 0 : chunkOf(i - 1)
      const key = `${bucket}:${chunk}`
      const last = segments[segments.length - 1]
      if (last && last.key === key) {
        last.points += ` ${screen[i].x.toFixed(2)},${screen[i].y.toFixed(2)}`
      } else {
        segments.push({
          key,
          bucket,
          opacity: CHUNK_OPACITY[chunk] ?? 1,
          points: svgPath([screen[i - 1], screen[i]]),
        })
      }
      if (!collapseChunks && segments.length > MAX_SEGMENTS) {
        // Pathological altitude jitter: drop the time fade to keep node count sane.
        collapseChunks = true
        segments.length = 0
        i = 0
      }
    }

    const step = bandStep(realHeight)
    const bands: Band[] = []
    for (let metres = step; metres < realHeight - 1e-6 && bands.length < MAX_BANDS; metres += step) {
      const up = metres * verticalScale
      const ring = [
        { east: minEast, north: minNorth, up },
        { east: maxEast, north: minNorth, up },
        { east: maxEast, north: maxNorth, up },
        { east: minEast, north: maxNorth, up },
      ].map((corner) => toScreen(projectPoint(corner, yaw, tilt)))
      bands.push({
        points: ring.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '),
        label: `${Math.round(metres)} m`,
        anchor: ring[0],
      })
    }

    const bucketLegend = Array.from({ length: BUCKET_COUNT }, (_, index) => {
      const low = (realHeight / BUCKET_COUNT) * index
      const high = (realHeight / BUCKET_COUNT) * (index + 1)
      return {
        index,
        label: `${Math.round(low)}–${Math.round(high)} m`,
      }
    })

    return {
      segments,
      shadow: svgPath(shadow.map(toScreen)),
      ground: corners.map(toScreen),
      bands,
      bucketLegend,
      start: screen[0],
      end: screen[screen.length - 1],
      closed: isClosedLoop(usable),
      axis: {
        base: toScreen(onGround({ east: minEast, north: minNorth, up: 0 })),
        top: toScreen(projectPoint({ east: minEast, north: minNorth, up: maxUp }, yaw, tilt)),
      },
      heightMeters: realHeight,
    }
  }, [usable, yaw, tilt, verticalScale])

  const rotate = (event: ReactPointerEvent<SVGSVGElement>) => {
    const state = drag.current
    if (!state) return
    if (event.shiftKey) {
      const ctm = svgRef.current?.getScreenCTM()
      const unitPerPixel = ctm?.a || 1
      zoomBy(1, undefined, {
        x: (event.clientX - state.x) * unitPerPixel,
        y: (event.clientY - state.y) * unitPerPixel,
      })
      drag.current = { ...state, x: event.clientX, y: event.clientY }
      return
    }
    setYaw(state.yaw + (event.clientX - state.x) * 0.012)
    setTilt(clamp(state.tilt - (event.clientY - state.y) * 0.008, 0, Math.PI / 2))
  }

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 1) {
      drag.current = { x: event.clientX, y: event.clientY, yaw, tilt }
      pinch.current = null
    } else if (pointers.current.size === 2) {
      drag.current = null
      const [a, b] = [...pointers.current.values()]
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
      }
    }
  }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      const factor = pinch.current.distance > 0 ? distance / pinch.current.distance : 1
      zoomBy(
        factor,
        { clientX: midX, clientY: midY },
        { x: midX - pinch.current.midX, y: midY - pinch.current.midY },
      )
      pinch.current = { distance, midX, midY }
      return
    }

    rotate(event)
  }

  const endPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }

  if (!geometry || !stats) {
    return (
      <div className="route-map-3d">
        <div className="route-map-empty">No altitude recorded for this run</div>
      </div>
    )
  }

  const { zoom, panX, panY } = camera
  const textScale = 1 / zoom
  const dotRadius = 2.4 / zoom

  return (
    <div className="route-map-3d">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        role="img"
        aria-label={`3D run route, altitude ${Math.round(stats.min)} to ${Math.round(stats.max)} metres`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <g
          transform={`translate(${VIEW / 2 + panX} ${VIEW / 2 + panY}) scale(${zoom}) translate(${-VIEW / 2} ${-VIEW / 2})`}
        >
          <polygon
            points={geometry.ground.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="var(--surface-2)"
            fillOpacity="0.7"
            stroke="var(--outline)"
            strokeWidth="0.4"
            vectorEffect="non-scaling-stroke"
          />

          {geometry.bands.map((band) => (
            <g key={band.label}>
              <polygon
                points={band.points}
                fill="none"
                stroke="var(--outline)"
                strokeWidth="0.4"
                strokeDasharray="1.5 2"
                opacity="0.55"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={band.anchor.x}
                y={band.anchor.y - 1 * textScale}
                fontSize={3 * textScale}
                fill="var(--muted)"
                textAnchor="start"
              >
                {band.label}
              </text>
            </g>
          ))}

          <line
            x1={geometry.axis.base.x}
            y1={geometry.axis.base.y}
            x2={geometry.axis.top.x}
            y2={geometry.axis.top.y}
            stroke="var(--outline)"
            strokeWidth="0.8"
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={geometry.axis.top.x}
            y={geometry.axis.top.y - 2 * textScale}
            fontSize={3.4 * textScale}
            fill="var(--muted)"
            textAnchor="middle"
          >
            {Math.round(geometry.heightMeters)} m
          </text>

          <polyline
            points={geometry.shadow}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="0.5"
            strokeDasharray="1.5 2"
            opacity="0.3"
            vectorEffect="non-scaling-stroke"
          />

          {geometry.segments.map((segment, index) => (
            <polyline
              key={`${segment.key}-${index}`}
              className={`route-seg route-alt-${segment.bucket}`}
              points={segment.points}
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={segment.opacity}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {geometry.closed ? (
            <LoopBadge x={geometry.start.x} y={geometry.start.y} radius={dotRadius} />
          ) : (
            <>
              <circle cx={geometry.start.x} cy={geometry.start.y} r={dotRadius} fill="var(--success)" />
              <circle cx={geometry.end.x} cy={geometry.end.y} r={dotRadius} fill="var(--error)" />
            </>
          )}
        </g>
      </svg>

      <div className="route-alt-legend">
        {geometry.bucketLegend.map((bucket) => (
          <span className="route-alt-chip" key={bucket.index}>
            <span className={`route-alt-swatch route-alt-${bucket.index}`} />
            {bucket.label}
          </span>
        ))}
      </div>

      <div className="route-3d-tools">
        <span className="tiny muted">Drag to rotate · pinch or scroll to zoom · fainter = earlier</span>
        <span className="grow" />
        <div className="segmented" role="group" aria-label="Zoom">
          <button
            onClick={() => zoomBy(1 / 1.6, undefined)}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            onClick={() => zoomBy(1.6, undefined)}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
        <Segmented
          value={String(verticalScale)}
          onChange={(value) => setVerticalScale(Number(value))}
          label="Height exaggeration"
          options={VERTICAL_SCALES.map((value) => ({
            value: String(value),
            label: `${value}×`,
          }))}
        />
        <button
          className="btn btn-sm btn-outline"
          onClick={() => {
            setYaw(DEFAULT_YAW)
            setTilt(DEFAULT_TILT)
            setVerticalScale(suggestedVerticalScale(usable))
            setCamera({ zoom: 1, panX: 0, panY: 0 })
          }}
        >
          Reset
        </button>
      </div>
    </div>
  )
}
