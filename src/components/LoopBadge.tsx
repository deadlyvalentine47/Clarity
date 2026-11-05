const GREEN = 'var(--success)'
const ACCENT = 'var(--warning)'

/**
 * Start/finish badge for a route that returns to where it began: two map dots
 * would sit on top of each other, hiding the start. Drawn as a yin-yang so both
 * endpoints stay visible — green for the start, amber for the finish, each with
 * the other's dot inside it.
 */
export default function LoopBadge({ x, y, radius }: { x: number; y: number; radius: number }) {
  const r = radius
  return (
    <g className="loop-badge" transform={`translate(${x} ${y})`}>
      <circle r={r} fill={ACCENT} stroke="var(--surface-2)" strokeWidth={r * 0.14} />
      <path
        d={`M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r} A ${r / 2} ${r / 2} 0 0 1 0 0 A ${r / 2} ${r / 2} 0 0 0 0 ${-r} Z`}
        fill={GREEN}
      />
      <circle cx={0} cy={r / 2} r={r * 0.2} fill={ACCENT} />
      <circle cx={0} cy={-r / 2} r={r * 0.2} fill={GREEN} />
    </g>
  )
}
