import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CalendarDays } from 'lucide-react'
import { formatDateKey, parseDisplayDate } from '../lib/dates'

/**
 * Date picker that always shows dd/mm/yyyy. Native date inputs format
 * themselves from the browser locale (M/D/Y in en-US), so the visible field is
 * a normal text input and an invisible native date input opens the system
 * picker from the calendar icon.
 */
export function DateField({
  value,
  onChange,
  ariaLabel = 'Date',
  id,
  min,
  max,
  style,
  className,
  disabled,
  autoFocus,
}: {
  /** YYYY-MM-DD, or '' when empty. */
  value: string
  onChange: (next: string) => void
  ariaLabel?: string
  id?: string
  min?: string
  max?: string
  style?: CSSProperties
  className?: string
  disabled?: boolean
  autoFocus?: boolean
}) {
  const [draft, setDraft] = useState(() => formatDateKey(value, true))
  const nativeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(formatDateKey(value, true))
  }, [value])

  return (
    <div className={`date-field${className ? ` ${className}` : ''}`} style={style}>
      <input
        id={id}
        className="input date-field-text"
        inputMode="numeric"
        autoFocus={autoFocus}
        disabled={disabled}
        value={draft}
        placeholder="dd/mm/yyyy"
        aria-label={ariaLabel}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          const parsed = parseDisplayDate(next)
          if (parsed != null) onChange(parsed)
        }}
        onBlur={() => {
          if (draft.trim() === '') {
            if (value !== '') onChange('')
            return
          }
          const parsed = parseDisplayDate(draft)
          if (parsed == null) setDraft(formatDateKey(value, true))
          else if (parsed !== value) onChange(parsed)
        }}
      />
      <span className="date-field-icon" aria-hidden="true">
        <CalendarDays size={18} />
      </span>
      <input
        ref={nativeRef}
        type="date"
        className="date-field-native"
        aria-hidden="true"
        tabIndex={-1}
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
