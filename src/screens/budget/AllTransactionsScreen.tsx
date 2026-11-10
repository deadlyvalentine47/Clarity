import { Fragment, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Wallet } from 'lucide-react'
import { db } from '../../db/db'
import type { CreditCardTransaction, Transaction } from '../../db/types'
import { dailySummary, transferPair } from '../../db/budget'
import { endOfDay, formatLongDate, fromDateKey, MONTHS, monthRange, startOfDay, toDateKey } from '../../lib/dates'
import { formatMoney, plural } from '../../lib/format'
import { DateField, EmptyState, ListSkeleton, PageHeader } from '../../components/ui'
import { ActivityRows, buildDailyActivity, type ActivityItem } from './ActivityList'
import { CardTransactionDialog, MonthYearPicker, TransactionDialog } from './shared'

type RangeMode = 'month' | 'day' | 'year'

const RANGE_MODES: { mode: RangeMode; label: string }[] = [
  { mode: 'month', label: 'Month' },
  { mode: 'day', label: 'Day' },
  { mode: 'year', label: 'Year' },
]

interface DayGroup {
  key: string
  timestamp: number
  items: ActivityItem[]
}

/** Month/year/day filter over every bank and card transaction in the ledger. */
export default function AllTransactionsScreen() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<RangeMode>('month')
  // A single local date anchors all three modes, so switching Month → Day keeps
  // the same month and Year → Month keeps the same year.
  const [anchor, setAnchor] = useState(() => new Date())
  const [editingTxn, setEditingTxn] = useState<{ txn: Transaction; pair?: { from: string; to: string } } | null>(null)
  const [editingCardTxn, setEditingCardTxn] = useState<CreditCardTransaction | null>(null)

  const transactions = useLiveQuery(async () => db.transactions.toArray(), [])
  const cardTxns = useLiveQuery(async () => db.creditCardTransactions.toArray(), [], [])
  const cards = useLiveQuery(async () => db.creditCards.toArray(), [], [])

  const year = anchor.getFullYear()
  const month = anchor.getMonth() + 1
  const dayKey = toDateKey(anchor)

  const [start, end] = useMemo<[number, number]>(() => {
    if (mode === 'day') {
      const ts = anchor.getTime()
      return [startOfDay(ts), endOfDay(ts)]
    }
    if (mode === 'month') return monthRange(year, month)
    return [new Date(year, 0, 1).getTime(), new Date(year, 11, 31, 23, 59, 59, 999).getTime()]
  }, [mode, anchor, year, month])

  const items = useMemo(
    () => buildDailyActivity(transactions ?? [], cardTxns ?? [], start, end),
    [transactions, cardTxns, start, end],
  )
  const totals = useMemo(
    () => dailySummary(transactions ?? [], cardTxns ?? [], start, end),
    [transactions, cardTxns, start, end],
  )
  const cardNameById = useMemo(
    () => new Map((cards ?? []).map((c) => [c.id!, c.name])),
    [cards],
  )

  // The year picker needs every year that has data (plus the selected one).
  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear(), year])
    for (const t of transactions ?? []) set.add(new Date(t.date).getFullYear())
    for (const t of cardTxns ?? []) set.add(new Date(t.date).getFullYear())
    return [...set].sort((a, b) => b - a)
  }, [transactions, cardTxns, year])

  // Day groups only matter for the month/year views; a single day is plain.
  const groups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, ActivityItem[]>()
    for (const item of items) {
      const key = toDateKey(item.date)
      const list = map.get(key)
      if (list) list.push(item)
      else map.set(key, [item])
    }
    return [...map.entries()]
      .map(([key, groupItems]) => ({ key, timestamp: fromDateKey(key).getTime(), items: groupItems }))
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [items])

  /** Move the anchor to `y/m/d`, clamping the day to the target month. */
  const setPeriod = (y: number, m: number, day?: number) => {
    const safeDay = Math.min(day ?? anchor.getDate(), new Date(y, m, 0).getDate())
    setAnchor(new Date(y, m - 1, safeDay, 12))
  }

  const step = (delta: -1 | 1) => {
    if (mode === 'day') {
      const next = new Date(anchor)
      next.setDate(next.getDate() + delta)
      setAnchor(next)
      return
    }
    if (mode === 'year') {
      setPeriod(year + delta, month)
      return
    }
    const target = new Date(year, month - 1 + delta, 1, 12)
    setPeriod(target.getFullYear(), target.getMonth() + 1)
  }

  const goToday = () => setAnchor(new Date())

  const changeDay = (value: string) => {
    const [y, m, d] = value.split('-').map(Number)
    if (!y || !m || !d) return
    setAnchor(new Date(y, m - 1, d, 12))
  }

  const rangeLabel =
    mode === 'day'
      ? formatLongDate(anchor)
      : mode === 'month'
        ? `${MONTHS[month - 1]} ${year}`
        : String(year)

  const openBankEdit = (txn: Transaction) => {
    const pair = transferPair(transactions ?? [], txn)
    setEditingTxn({ txn, pair: pair ?? undefined })
  }

  const renderRows = (rows: ActivityItem[]) => (
    <div className="card flush">
      <ActivityRows
        items={rows}
        cardNameById={cardNameById}
        onEditBank={openBankEdit}
        onEditCard={setEditingCardTxn}
      />
    </div>
  )

  if (transactions === undefined) return <ListSkeleton rows={5} />

  return (
    <>
      <PageHeader
        title="All transactions"
        subtitle={rangeLabel}
        onBack={() => navigate('/budget/activity')}
        actions={
          <button className="btn btn-sm btn-outline" onClick={goToday}>
            <CalendarDays size={16} /> Today
          </button>
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="chip-row" role="group" aria-label="Filter by period" style={{ marginBottom: 12 }}>
          {RANGE_MODES.map(({ mode: value, label }) => (
            <button
              key={value}
              type="button"
              className={`chip ${mode === value ? 'active' : ''}`}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="period-nav">
          <button
            type="button"
            className="icon-btn"
            aria-label={mode === 'day' ? 'Previous day' : mode === 'year' ? 'Previous year' : 'Previous month'}
            onClick={() => step(-1)}
          >
            <ChevronLeft size={20} />
          </button>

          {mode === 'month' && (
            <MonthYearPicker
              year={year}
              month={month}
              years={years}
              onChange={(y, m) => setPeriod(y, m)}
            />
          )}

          {mode === 'day' && (
            <DateField
              value={dayKey}
              onChange={changeDay}
              ariaLabel="Date"
              style={{ width: 150, flex: '0 0 auto' }}
            />
          )}

          {mode === 'year' && (
            <select
              className="select"
              aria-label="Year"
              style={{ width: 'auto', minWidth: 96 }}
              value={year}
              onChange={(e) => setPeriod(Number(e.target.value), month)}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="icon-btn"
            aria-label={mode === 'day' ? 'Next day' : mode === 'year' ? 'Next year' : 'Next month'}
            onClick={() => step(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="hero-row" style={{ marginTop: 0 }}>
          <div>
            <div className="hero-label">Spent</div>
            <div className="bold" style={{ color: 'var(--error)' }}>{formatMoney(totals.spent)}</div>
          </div>
          <div>
            <div className="hero-label">Earned</div>
            <div className="bold" style={{ color: 'var(--success)' }}>{formatMoney(totals.earned)}</div>
          </div>
          <div>
            <div className="hero-label">Net</div>
            <div className="bold">{formatMoney(totals.earned - totals.spent)}</div>
          </div>
        </div>
        <div className="tiny muted" style={{ marginTop: 10 }}>
          {plural(items.length, 'transaction')} · transfers excluded from totals
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Wallet size={40} />}
            title="No transactions"
            subtitle={`Nothing recorded in ${rangeLabel}.`}
          />
        </div>
      ) : mode === 'day' ? (
        renderRows(items)
      ) : (
        groups.map((group, index) => {
          const monthKey = group.key.slice(0, 7)
          const newMonth = mode === 'year' && monthKey !== groups[index - 1]?.key.slice(0, 7)
          return (
            <Fragment key={group.key}>
              {newMonth && (
                <div className="section-label" style={{ margin: '18px 2px 8px' }}>
                  {new Date(group.timestamp).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
              )}
              <div className="row-between" style={{ margin: '0 2px 6px' }}>
                <span className="small bold">{formatLongDate(group.timestamp)}</span>
                <span className="tiny muted">{plural(group.items.length, 'transaction')}</span>
              </div>
              {renderRows(group.items)}
              <div style={{ height: 4 }} />
            </Fragment>
          )
        })
      )}

      {editingTxn && (
        <TransactionDialog
          transaction={editingTxn.txn}
          transferFrom={editingTxn.pair?.from}
          transferTo={editingTxn.pair?.to}
          onClose={() => setEditingTxn(null)}
        />
      )}
      {editingCardTxn && (
        <CardTransactionDialog
          cardId={editingCardTxn.cardId}
          transaction={editingCardTxn}
          onClose={() => setEditingCardTxn(null)}
        />
      )}
      <div className="tiny muted" style={{ marginTop: 4 }}>
        Bank and credit-card transactions, newest first
      </div>
    </>
  )
}
