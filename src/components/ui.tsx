import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { ArrowLeft, Check, X } from 'lucide-react'
import { formatAmountDisplay, formatMoney, formatMoneyWords, sanitizeAmountInput } from '../lib/format'

export function IconButton({
  label,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button className="icon-btn" aria-label={label} title={label} {...rest}>
      {children}
    </button>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={`checkbox ${checked ? 'checked' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <Check size={15} />
    </button>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="tiny muted">{hint}</span>}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />
}

/**
 * Money field: shows Indian-grouped commas while typing and prints the amount
 * in words underneath (cheque style). The stored value stays a plain number
 * string — formatting is display-only.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder = '0.00',
  autoFocus,
  label = 'Amount',
}: {
  value: string
  onChange: (raw: string) => void
  placeholder?: string
  autoFocus?: boolean
  label?: string
}) {
  const numeric = Number(value)
  const showHint = value !== '' && Number.isFinite(numeric) && numeric > 0
  return (
    <div>
      <input
        className="input"
        inputMode="decimal"
        autoFocus={autoFocus}
        aria-label={label}
        placeholder={placeholder}
        value={formatAmountDisplay(value)}
        onChange={(e) => onChange(sanitizeAmountInput(e.target.value))}
      />
      {showHint && (
        <div className="tiny muted" style={{ marginTop: 4 }}>
          {formatMoney(numeric)} · {formatMoneyWords(numeric)}
        </div>
      )}
    </div>
  )
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="textarea" {...props} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="select" {...props} />
}

// Tracks nested dialogs so closing an inner one doesn't unlock body scroll
// while an outer dialog is still open.
let openDialogCount = 0

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const node = dialogRef.current
    const focusables = () =>
      node
        ? Array.from(
            node.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          )
        : []

    const raf = requestAnimationFrame(() => {
      const first = focusables()[0]
      if (first) first.focus()
      else node?.focus()
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const els = focusables()
      if (els.length === 0) {
        e.preventDefault()
        node?.focus()
        return
      }
      const firstEl = els[0]
      const lastEl = els[els.length - 1]
      const active = document.activeElement
      if (e.shiftKey) {
        if (active === firstEl || !node?.contains(active)) {
          e.preventDefault()
          lastEl.focus()
        }
      } else if (active === lastEl || !node?.contains(active)) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    openDialogCount += 1
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      openDialogCount = Math.max(0, openDialogCount - 1)
      if (openDialogCount === 0) document.body.style.overflow = ''
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="row-between" style={{ marginBottom: 16 }}>
          <h2 className="dialog-title">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
        {footer && <div style={{ marginTop: 20 }}>{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title = 'Delete?',
  message,
  confirmLabel = 'Delete',
  alternateAction,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  alternateAction?: { label: string; onClick: () => void }
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          {alternateAction && (
            <button className="btn btn-outline" onClick={alternateAction.onClick}>
              {alternateAction.label}
            </button>
          )}
          <button className="btn btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="muted">{message}</p>
    </Dialog>
  )
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      {icon}
      <div className="bold" style={{ color: 'var(--text)' }}>
        {title}
      </div>
      {subtitle && <div className="small">{subtitle}</div>}
      {action}
    </div>
  )
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="progress">
      <span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  )
}

/**
 * Circular progress with the value centred inside. Used by the home hero; the
 * SVG is decorative and the visible number carries the meaning for screen
 * readers via `label`.
 */
export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  label,
  children,
}: {
  value: number
  size?: number
  stroke?: number
  label: string
  children?: ReactNode
}) {
  const clamped = Math.max(0, Math.min(1, value))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped)
  return (
    <div
      className="ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${Math.round(clamped * 100)}%`}
    >
      <svg width={size} height={size} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={clamped >= 1 ? 'var(--success)' : 'var(--primary)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring-label">{children ?? `${Math.round(clamped * 100)}%`}</span>
    </div>
  )
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="chip-row">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={`chip ${o === value ? 'active' : ''}`}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
  onBack,
  wrapTitle = false,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  onBack?: () => void
  /** show the full title instead of truncating it to one line */
  wrapTitle?: boolean
}) {
  return (
    <div className="page-header">
      <div className="page-header-main">
        {onBack && (
          <IconButton label="Back" onClick={onBack} style={{ marginLeft: -8 }}>
            <ArrowLeft size={22} />
          </IconButton>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 className={`page-title ${wrapTitle ? 'wrap-anywhere' : 'truncate'}`}>{title}</h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  )
}

/** Accessible collapse header used by dashboard/home/settings sections. */
export function CollapsibleHeader({
  title,
  open,
  onToggle,
  action,
  icon,
  meta,
}: {
  title: string
  open: boolean
  onToggle: () => void
  action?: ReactNode
  icon?: ReactNode
  meta?: string
}) {
  return (
    <div className="row-between">
      <button
        type="button"
        className="collapse-head"
        aria-expanded={open}
        onClick={onToggle}
      >
        {icon && <span className="collapse-icon">{icon}</span>}
        <span className="section-label">{title}</span>
        {meta && <span className="collapse-meta">{meta}</span>}
        <span className={`chevron ${open ? 'open' : ''}`}>⌄</span>
      </button>
      {action}
    </div>
  )
}

export function priorityClass(priority: string): string {
  if (priority === 'High') return 'high'
  if (priority === 'Low') return 'low'
  return 'medium'
}
