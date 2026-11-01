export function formatMoney(amount: number, currency = '₹'): string {
  const rounded = Math.round(amount * 100) / 100
  const hasFraction = Math.abs(rounded % 1) > 0.001
  return `${currency}${rounded.toLocaleString('en-IN', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** 1 -> 1st, 2 -> 2nd, 11 -> 11th … */
export function ordinal(n: number): string {
  const abs = Math.abs(n) % 100
  const suffix =
    abs >= 11 && abs <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'
  return `${n}${suffix}`
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`
}

/** "1 day" / "3 days" without hand-rolled ternaries at each call site. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}
