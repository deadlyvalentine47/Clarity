export function formatMoney(amount: number, currency = '₹'): string {
  const rounded = Math.round(amount * 100) / 100
  const hasFraction = Math.abs(rounded % 1) > 0.001
  return `${currency}${rounded.toLocaleString('en-IN', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n]
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return ones ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens]
}

/** Indian numbering: crore / lakh / thousand / hundred. */
function integerWordsIndian(n: number): string {
  if (n === 0) return 'Zero'
  const parts: string[] = []
  const crore = Math.floor(n / 10_000_000)
  const lakh = Math.floor((n % 10_000_000) / 100_000)
  const thousand = Math.floor((n % 100_000) / 1_000)
  const hundred = Math.floor((n % 1_000) / 100)
  const rest = n % 100
  if (crore) parts.push(`${integerWordsIndian(crore)} Crore`)
  if (lakh) parts.push(`${twoDigitWords(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`)
  if (hundred) parts.push(`${ONES[hundred]} Hundred`)
  if (rest) parts.push(twoDigitWords(rest))
  return parts.join(' ')
}

/** "One Crore Rupees and Fifty Paise Only" */
export function formatMoneyWords(amount: number, currency = 'Rupees'): string {
  if (!Number.isFinite(amount)) return ''
  const negative = amount < 0
  const abs = Math.abs(amount)
  let rupees = Math.floor(abs + 1e-9)
  let paise = Math.round((abs - rupees) * 100)
  if (paise >= 100) {
    rupees += 1
    paise -= 100
  }
  const parts: string[] = []
  if (rupees > 0) parts.push(`${integerWordsIndian(rupees)} ${currency}`)
  if (paise > 0) parts.push(`${twoDigitWords(paise)} Paise`)
  if (parts.length === 0) return `Zero ${currency} Only`
  return `${negative ? 'Minus ' : ''}${parts.join(' and ')} Only`
}

/** Keep digits and at most one decimal point with two places. */
export function sanitizeAmountInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '')
  const dot = cleaned.indexOf('.')
  if (dot === -1) return cleaned
  const intPart = cleaned.slice(0, dot)
  const decPart = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2)
  return `${intPart}.${decPart}`
}

/** Indian-grouped display for a raw amount string ("10000000" -> "1,00,00,000"). */
export function formatAmountDisplay(raw: string): string {
  if (!raw) return ''
  const [intPart, decPart] = raw.split('.')
  const digits = intPart.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  let grouped = ''
  if (digits) {
    const last3 = digits.slice(-3)
    const rest = digits.slice(0, -3)
    grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3
  }
  return raw.includes('.') ? `${grouped || '0'}.${decPart ?? ''}` : grouped
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
