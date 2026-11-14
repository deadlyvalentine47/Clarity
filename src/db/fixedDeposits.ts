import { db } from './db'
import { adjustBalance, FD_FUNDING_CATEGORY } from './budget'
import type { FdCompounding, FdMode, FixedDeposit } from './types'

export const FD_MODES: FdMode[] = ['Cumulative', 'Payout']
export const FD_COMPOUNDINGS: FdCompounding[] = ['Quarterly', 'Monthly', 'Annual', 'Simple']

export const FD_COMPOUNDING_LABELS: Record<FdCompounding, string> = {
  Quarterly: 'Quarterly (4× a year)',
  Monthly: 'Monthly (12× a year)',
  Annual: 'Annual',
  Simple: 'Simple (no compounding)',
}

const DAY_MS = 86_400_000

export interface FixedDepositInput {
  name: string
  principal: number
  annualRate: number
  startDate: number
  tenureMonths: number
  mode: FdMode
  compounding: FdCompounding
  maturityAmountOverride: number | null
  source: string
  notes: string
}

function addMonthsClamped(ts: number, months: number): number {
  const d = new Date(ts)
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1, 12, 0, 0, 0)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), lastDay))
  return target.getTime()
}

export function fdMaturityDate(fd: Pick<FixedDeposit, 'startDate' | 'tenureMonths'>): number {
  return addMonthsClamped(fd.startDate, Math.max(1, Math.round(fd.tenureMonths)))
}

/**
 * Tenure in years from the actual start-to-maturity dates. A 24-month FD that
 * crosses a leap day is slightly longer than 2.0 years, which is what banks
 * accrue; using months/12 lost that extra day.
 */
export function fdTenureYears(fd: Pick<FixedDeposit, 'startDate' | 'tenureMonths'>): number {
  const days = (fdMaturityDate(fd) - fd.startDate) / DAY_MS
  return Math.max(0, days / 365.25)
}

function compoundingPerYear(compounding: FdCompounding): number {
  if (compounding === 'Quarterly') return 4
  if (compounding === 'Monthly') return 12
  if (compounding === 'Annual') return 1
  return 0
}

/** Maturity amount, using the bank's stated value when supplied. */
export function fdMaturityAmount(fd: FixedDeposit): number {
  if (fd.maturityAmountOverride != null) return fd.maturityAmountOverride
  const principal = fd.principal
  const rate = Math.max(0, fd.annualRate) / 100
  const years = fdTenureYears(fd)
  if (fd.mode === 'Payout' || fd.compounding === 'Simple') {
    return principal * (1 + rate * years)
  }
  const n = compoundingPerYear(fd.compounding)
  return principal * Math.pow(1 + rate / n, n * years)
}

export function fdTotalInterest(fd: FixedDeposit): number {
  return fdMaturityAmount(fd) - fd.principal
}

export function fdAccruedInterest(fd: FixedDeposit, now: number = Date.now()): number {
  const start = fd.startDate
  const end = fdMaturityDate(fd)
  const until = Math.min(Math.max(now, start), end)
  const years = Math.min((until - start) / (365.25 * DAY_MS), fdTenureYears(fd))
  const rate = Math.max(0, fd.annualRate) / 100
  if (fd.mode === 'Payout' || fd.compounding === 'Simple') {
    return fd.principal * rate * years
  }
  const n = compoundingPerYear(fd.compounding)
  return fd.principal * (Math.pow(1 + rate / n, n * years) - 1)
}

/**
 * Current asset value: the compounded balance for a cumulative FD, and the
 * principal for a payout FD (its interest has already been paid out).
 */
export function fdCurrentValue(fd: FixedDeposit, now: number = Date.now()): number {
  if (fd.mode === 'Payout') return fd.principal
  if (now >= fdMaturityDate(fd)) return fdMaturityAmount(fd)
  return fd.principal + fdAccruedInterest(fd, now)
}

export function fdProgress(fd: FixedDeposit, now: number = Date.now()): number {
  const start = fd.startDate
  const end = fdMaturityDate(fd)
  if (end <= start) return 1
  return Math.min(1, Math.max(0, (now - start) / (end - start)))
}

export function fdDaysToMaturity(fd: FixedDeposit, now: number = Date.now()): number {
  return Math.ceil((fdMaturityDate(fd) - now) / DAY_MS)
}

export function fdStatus(fd: FixedDeposit, now: number = Date.now()): 'Active' | 'Matured' {
  return now >= fdMaturityDate(fd) ? 'Matured' : 'Active'
}

/** Effective annual yield from the chosen compounding. */
export function fdEffectiveYield(fd: FixedDeposit): number {
  const rate = Math.max(0, fd.annualRate) / 100
  if (fd.mode === 'Payout' || fd.compounding === 'Simple') return rate
  const n = compoundingPerYear(fd.compounding)
  return Math.pow(1 + rate / n, n) - 1
}

export interface FdSummary {
  principal: number
  accruedInterest: number
  currentValue: number
  maturityValue: number
  active: number
  matured: number
}

export function summarizeFixedDeposits(
  deposits: FixedDeposit[],
  now: number = Date.now(),
): FdSummary {
  const summary: FdSummary = {
    principal: 0,
    accruedInterest: 0,
    currentValue: 0,
    maturityValue: 0,
    active: 0,
    matured: 0,
  }
  for (const fd of deposits) {
    summary.principal += fd.principal
    summary.accruedInterest += fdAccruedInterest(fd, now)
    summary.currentValue += fdCurrentValue(fd, now)
    summary.maturityValue += fdMaturityAmount(fd)
    if (fdStatus(fd, now) === 'Active') summary.active += 1
    else summary.matured += 1
  }
  return summary
}

async function fundingTransaction(fundingKey: string | null) {
  if (!fundingKey) return undefined
  return db.transactions.filter((txn) => txn.fdFundingKey === fundingKey).first()
}

function fundingDescription(name: string): string {
  return `FD — ${name}`
}

export async function addFixedDeposit(input: FixedDepositInput): Promise<number> {
  const now = Date.now()
  const fundingKey = input.source ? crypto.randomUUID() : null
  return db.transaction('rw', db.fixedDeposits, db.transactions, db.sources, async () => {
    if (input.source && fundingKey) {
      await db.transactions.add({
        type: 'Expense',
        amount: input.principal,
        category: FD_FUNDING_CATEGORY,
        source: input.source,
        description: fundingDescription(input.name),
        date: input.startDate,
        isRecurring: false,
        recurringType: null,
        createdAt: now,
        fdFundingKey: fundingKey,
      })
      await adjustBalance(input.source, -input.principal)
    }
    return (await db.fixedDeposits.add({
      ...input,
      fundingKey,
      createdAt: now,
    })) as number
  })
}

export async function updateFixedDeposit(
  fd: FixedDeposit,
  input: FixedDepositInput,
): Promise<void> {
  if (fd.id == null) return
  let fundingKey = fd.fundingKey

  await db.transaction('rw', db.fixedDeposits, db.transactions, db.sources, async () => {
    const existing = await fundingTransaction(fd.fundingKey)
    if (!input.source) {
      if (existing?.id != null) {
        await db.transactions.delete(existing.id)
        await adjustBalance(existing.source, existing.amount)
      }
      fundingKey = null
    } else if (existing?.id != null) {
      // Reverse the old debit, update the row, then apply the new amount/source.
      await adjustBalance(existing.source, existing.amount)
      await db.transactions.update(existing.id, {
        amount: input.principal,
        source: input.source,
        date: input.startDate,
        description: fundingDescription(input.name),
        category: FD_FUNDING_CATEGORY,
      })
      await adjustBalance(input.source, -input.principal)
      fundingKey = fd.fundingKey ?? crypto.randomUUID()
    } else {
      fundingKey = crypto.randomUUID()
      await db.transactions.add({
        type: 'Expense',
        amount: input.principal,
        category: FD_FUNDING_CATEGORY,
        source: input.source,
        description: fundingDescription(input.name),
        date: input.startDate,
        isRecurring: false,
        recurringType: null,
        createdAt: Date.now(),
        fdFundingKey: fundingKey,
      })
      await adjustBalance(input.source, -input.principal)
    }

    await db.fixedDeposits.update(fd.id!, {
      ...input,
      fundingKey,
    })
  })
}

export async function deleteFixedDeposit(fd: FixedDeposit): Promise<void> {
  await db.transaction('rw', db.fixedDeposits, db.transactions, db.sources, async () => {
    const existing = await fundingTransaction(fd.fundingKey)
    if (existing?.id != null) {
      await db.transactions.delete(existing.id)
      await adjustBalance(existing.source, existing.amount)
    }
    if (fd.id != null) await db.fixedDeposits.delete(fd.id)
  })
}

/** Rebuild a row from a backup; unknown or mistyped fields are discarded. */
export function fixedDepositDefaults(raw: Partial<FixedDeposit>): FixedDeposit {
  const finite = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback
  const mode: FdMode = raw.mode === 'Payout' ? 'Payout' : 'Cumulative'
  const compounding: FdCompounding =
    raw.compounding === 'Monthly' ||
    raw.compounding === 'Annual' ||
    raw.compounding === 'Simple' ||
    raw.compounding === 'Quarterly'
      ? raw.compounding
      : 'Quarterly'
  return {
    name: String(raw.name ?? 'Fixed Deposit'),
    principal: Math.max(0, finite(raw.principal, 0)),
    annualRate: Math.max(0, finite(raw.annualRate, 0)),
    startDate: finite(raw.startDate, Date.now()),
    tenureMonths: Math.max(1, Math.round(finite(raw.tenureMonths, 12))),
    mode,
    compounding: mode === 'Payout' ? 'Simple' : compounding,
    maturityAmountOverride:
      typeof raw.maturityAmountOverride === 'number' &&
      Number.isFinite(raw.maturityAmountOverride)
        ? Math.max(0, raw.maturityAmountOverride)
        : null,
    source: String(raw.source ?? ''),
    fundingKey: typeof raw.fundingKey === 'string' ? raw.fundingKey : null,
    notes: String(raw.notes ?? ''),
    createdAt: finite(raw.createdAt, Date.now()),
  }
}
