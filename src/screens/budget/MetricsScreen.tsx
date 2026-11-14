import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { BarChart3, ChevronDown, ChevronUp, CreditCard, Landmark, LineChart } from 'lucide-react'
import { db } from '../../db/db'
import { cardPurchasesInCycle, isFdFunding, isSelfTransfer, summarizeBudget } from '../../db/budget'
import { summarizeFixedDeposits } from '../../db/fixedDeposits'
import { monthRange } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { PageHeader, ListSkeleton } from '../../components/ui'
import { MonthYearPicker } from './shared'

export default function BudgetMetricsScreen() {
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [bankOpen, setBankOpen] = useState(true)
  const [cardsOpen, setCardsOpen] = useState(true)
  const [investOpen, setInvestOpen] = useState(true)

  const transactions = useLiveQuery(async () => db.transactions.toArray(), [])
  const cards = useLiveQuery(async () => db.creditCards.toArray(), [], [])
  const cardTxns = useLiveQuery(async () => db.creditCardTransactions.toArray(), [], [])
  const investments = useLiveQuery(async () => db.investments.toArray(), [], [])
  const fixedDeposits = useLiveQuery(async () => db.fixedDeposits.toArray(), [], [])
  const sources = useLiveQuery(async () => db.sources.toArray(), [], [])

  const [start, end] = monthRange(year, month)
  const monthTxns = useMemo(
    () =>
      (transactions ?? []).filter(
        (t) => t.date >= start && t.date <= end && !isSelfTransfer(t) && !isFdFunding(t),
      ),
    [transactions, start, end],
  )

  const income = monthTxns.filter((t) => t.type === 'Income').reduce((s, t) => s + t.amount, 0)
  const expenses = monthTxns.filter((t) => t.type === 'Expense').reduce((s, t) => s + t.amount, 0)
  const net = income - expenses

  const bySource = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>()
    for (const t of monthTxns) {
      const key = t.source || 'Unknown'
      const row = map.get(key) ?? { income: 0, expense: 0 }
      if (t.type === 'Income') row.income += t.amount
      else row.expense += t.amount
      map.set(key, row)
    }
    return [...map.entries()].sort((a, b) => b[1].expense + b[1].income - (a[1].expense + a[1].income))
  }, [monthTxns])

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of monthTxns) {
      if (t.type !== 'Expense') continue
      const key = t.category || 'Uncategorized'
      map.set(key, (map.get(key) ?? 0) + t.amount)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [monthTxns])

  // Card spending follows each card's billing cycle that ends in this month,
  // matching the card detail screen (e.g. Oct 21 – Nov 20 for November).
  const cardSpending = useMemo(
    () =>
      (cards ?? [])
        .map(
          (card) =>
            [card.name, cardPurchasesInCycle(card, cardTxns ?? [], year, month)] as [string, number],
        )
        .sort((a, b) => b[1] - a[1]),
    [cards, cardTxns, year, month],
  )

  const fdSummary = summarizeFixedDeposits(fixedDeposits ?? [])
  const totals = summarizeBudget({
    sources: sources ?? [],
    cardTxns: cardTxns ?? [],
    investments: investments ?? [],
    fixedDepositValue: fdSummary.currentValue,
  })
  const totalInvested = (investments ?? []).reduce((s, i) => s + i.units * i.purchasePrice, 0)
  const totalCurrent = totals.investmentValue
  const fdValue = totals.fixedDepositValue
  const profitLoss = totalCurrent - totalInvested
  const bankBalance = totals.bankBalance
  const ccDebt = totals.cardDebt
  const ccCredit = totals.cardCredit
  const netWorth = totals.netWorth
  const maxCategory = Math.max(...byCategory.map(([, v]) => v), 1)

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  if (
    transactions === undefined ||
    cards === undefined ||
    cardTxns === undefined ||
    investments === undefined ||
    fixedDeposits === undefined ||
    sources === undefined
  ) {
    return <ListSkeleton rows={6} />
  }

  return (
    <>
      <PageHeader
        title="Metrics"
        subtitle="Monthly bank, card and investment summary"
        onBack={() => navigate('/budget')}
        actions={<MonthYearPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />}
      />

      <div className="hero" style={{ marginBottom: 16 }}>
        <div className="hero-label">Net worth · {monthLabel}</div>
        <div className="big-amount">{formatMoney(netWorth)}</div>
        <div className="hero-row" style={{ flexWrap: 'wrap' }}>
          <div>
            <div className="hero-label">Bank</div>
            <div className="bold">{formatMoney(bankBalance)}</div>
          </div>
          <div>
            <div className="hero-label">Investments</div>
            <div className="bold">{formatMoney(totalCurrent)}</div>
          </div>
          <div>
            <div className="hero-label">Fixed deposits</div>
            <div className="bold" style={{ color: 'var(--warning)' }}>
              {formatMoney(fdValue)}
            </div>
          </div>
          <div>
            <div className="hero-label">{ccCredit > 0 ? 'Card credit' : 'Card debt'}</div>
            <div className="bold" style={{ color: ccDebt > 0 ? 'var(--error)' : 'var(--success)' }}>
              {formatMoney(ccCredit > 0 ? ccCredit : ccDebt)}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <button
          className="row-between"
          style={{ background: 'none', border: 'none', width: '100%', padding: 0, cursor: 'pointer', color: 'inherit' }}
          onClick={() => setBankOpen((v) => !v)}
          aria-expanded={bankOpen}
        >
          <span className="row">
            <Landmark size={18} style={{ color: 'var(--primary)' }} />
            <span className="bold">Bank</span>
          </span>
          {bankOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {bankOpen && (
          <div style={{ marginTop: 12 }}>
            <div className="hero-row" style={{ marginTop: 0 }}>
              <div>
                <div className="hero-label">Credits</div>
                <div className="money-positive">{formatMoney(income)}</div>
              </div>
              <div>
                <div className="hero-label">Spending</div>
                <div className="money-negative">{formatMoney(expenses)}</div>
              </div>
              <div>
                <div className="hero-label">Net</div>
                <div className={net >= 0 ? 'money-positive' : 'money-negative'}>{formatMoney(net)}</div>
              </div>
            </div>

            {bySource.length > 0 && (
              <>
                <hr className="hr" />
                <div className="section-label" style={{ marginBottom: 6 }}>By account</div>
                <div className="row" style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)' }}>
                  <span className="grow">Account</span>
                  <span style={{ width: 90, textAlign: 'right' }}>Credits</span>
                  <span style={{ width: 90, textAlign: 'right' }}>Spends</span>
                </div>
                {bySource.map(([name, row]) => (
                  <div key={name} className="row" style={{ padding: '6px 0', borderTop: '1px solid var(--outline)' }}>
                    <span className="grow truncate">{name}</span>
                    <span style={{ width: 90, textAlign: 'right' }} className="small money-positive">{formatMoney(row.income)}</span>
                    <span style={{ width: 90, textAlign: 'right' }} className="small money-negative">{formatMoney(row.expense)}</span>
                  </div>
                ))}
              </>
            )}

            {byCategory.length > 0 && (
              <>
                <hr className="hr" />
                <div className="section-label" style={{ marginBottom: 8 }}>By category</div>
                <div className="stack" style={{ gap: 8 }}>
                  {byCategory.map(([cat, amount]) => (
                    <div key={cat} className="bar-row">
                      <span className="small truncate" style={{ width: 100, flex: '0 0 100px' }}>{cat}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${(amount / maxCategory) * 100}%`, background: 'var(--error)' }} />
                      </div>
                      <span className="tiny bold" style={{ width: 76, textAlign: 'right', flex: '0 0 76px' }}>{formatMoney(amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <button
          className="row-between"
          style={{ background: 'none', border: 'none', width: '100%', padding: 0, cursor: 'pointer', color: 'inherit' }}
          onClick={() => setCardsOpen((v) => !v)}
          aria-expanded={cardsOpen}
        >
          <span className="row">
            <CreditCard size={18} style={{ color: 'var(--secondary)' }} />
            <span className="bold">Credit Cards</span>
          </span>
          {cardsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {cardsOpen && (
          <div style={{ marginTop: 12 }}>
            <div className="section-label" style={{ marginBottom: 6 }}>Spends · billing cycle</div>
            {cardSpending.every(([, v]) => v === 0) ? (
              <p className="small muted">No card spending in this cycle.</p>
            ) : (
              cardSpending.filter(([, v]) => v > 0).map(([name, value]) => (
                <div key={name} className="row" style={{ padding: '6px 0', borderTop: '1px solid var(--outline)' }}>
                  <span className="grow truncate">{name}</span>
                  <span className="money-negative">{formatMoney(value)}</span>
                </div>
              ))
            )}
            <p className="tiny muted" style={{ marginTop: 8 }}>
              Each card uses its own billing cycle ending in {monthLabel}.
            </p>
            <p className="tiny muted" style={{ marginTop: 4 }}>
              {ccCredit > 0
                ? `All cards are in credit by ${formatMoney(ccCredit)}`
                : `Outstanding across all cards: ${formatMoney(ccDebt)}`}
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <button
          className="row-between"
          style={{ background: 'none', border: 'none', width: '100%', padding: 0, cursor: 'pointer', color: 'inherit' }}
          onClick={() => setInvestOpen((v) => !v)}
          aria-expanded={investOpen}
        >
          <span className="row">
            <LineChart size={18} style={{ color: 'var(--success)' }} />
            <span className="bold">Investments</span>
          </span>
          {investOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {investOpen && (
          <div className="hero-row" style={{ marginTop: 12 }}>
            <div>
              <div className="hero-label">Value</div>
              <div className="bold">{formatMoney(totalCurrent)}</div>
            </div>
            <div>
              <div className="hero-label">Invested</div>
              <div className="bold">{formatMoney(totalInvested)}</div>
            </div>
            <div>
              <div className="hero-label">P&amp;L</div>
              <div className="bold" style={{ color: profitLoss >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {formatMoney(profitLoss)}
              </div>
            </div>
          </div>
        )}
      </div>

      {(transactions ?? []).length === 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row">
            <BarChart3 size={20} className="muted" />
            <span className="small muted">Add transactions to see meaningful metrics.</span>
          </div>
        </div>
      )}
    </>
  )
}
