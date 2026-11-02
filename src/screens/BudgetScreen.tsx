import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  CreditCard,
  Landmark,
  LineChart,
  Plus,
  Settings2,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { db } from '../db/db'
import { totalBankBalance, cardOutstanding, dailySummary, transferPair } from '../db/budget'
import type { CreditCardTransaction, Transaction, TransactionType } from '../db/types'
import { PageHeader, EmptyState } from '../components/ui'
import { formatMoney } from '../lib/format'
import { endOfDay, startOfDay } from '../lib/dates'
import { CardTransactionDialog, ManageSourcesCategoriesDialog, TransactionDialog } from './budget/shared'
import { ActivityRows, buildDailyActivity } from './budget/ActivityList'

export default function BudgetScreen() {
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState<TransactionType | null>(null)
  const [showManage, setShowManage] = useState(false)
  const [editingTxn, setEditingTxn] = useState<{ txn: Transaction; pair?: { from: string; to: string } } | null>(null)
  const [editingCardTxn, setEditingCardTxn] = useState<CreditCardTransaction | null>(null)

  const sources = useLiveQuery(async () => db.sources.toArray(), [], [])
  const categories = useLiveQuery(async () => db.categories.toArray(), [], [])
  const cards = useLiveQuery(async () => db.creditCards.toArray(), [], [])
  const cardTxns = useLiveQuery(async () => db.creditCardTransactions.toArray(), [], [])
  const investments = useLiveQuery(async () => db.investments.toArray(), [], [])
  const transactions = useLiveQuery(
    async () => (await db.transactions.toArray()).sort((a, b) => b.date - a.date),
    [],
    [],
  )
  // Recent activity is scoped to today in local time; it naturally resets at
  // midnight. The hub shows the latest five, the full day lives on its own screen.
  const dayStart = startOfDay()
  const dayEnd = endOfDay()
  const cardNameById = new Map((cards ?? []).map((c) => [c.id!, c.name]))
  const dailyActivity = buildDailyActivity(transactions ?? [], cardTxns ?? [], dayStart, dayEnd)
  const todayTotals = dailySummary(transactions ?? [], cardTxns ?? [], dayStart, dayEnd)
  const recentActivity = dailyActivity.slice(0, 5)

  const openEdit = (txn: Transaction) => {
    const pair = transferPair(transactions ?? [], txn)
    setEditingTxn({ txn, pair: pair ?? undefined })
  }

  const bankBalance = totalBankBalance(sources ?? [])
  const investmentValue = (investments ?? []).reduce((sum, i) => sum + i.units * i.currentPrice, 0)
  const ccOutstanding = (cards ?? []).reduce(
    (sum, card) =>
      sum +
      Math.max(0, cardOutstanding((cardTxns ?? []).filter((t) => t.cardId === card.id))),
    0,
  )

  const statCards = [
    {
      label: 'Bank Balance',
      value: formatMoney(bankBalance),
      icon: Landmark,
      tone: 'var(--primary)',
      to: '/budget/accounts',
    },
    {
      label: 'Investments',
      value: formatMoney(investmentValue),
      icon: LineChart,
      tone: 'var(--secondary)',
      to: '/budget/investments',
    },
    {
      label: 'CC Outstanding',
      value: formatMoney(ccOutstanding),
      icon: CreditCard,
      tone: ccOutstanding > 0 ? 'var(--error)' : 'var(--success)',
      to: '/budget/cards',
    },
  ]

  const navCards = [
    {
      title: 'Accounts',
      subtitle: 'Track every bank account, credit and spend',
      icon: Landmark,
      to: '/budget/accounts',
    },
    {
      title: 'Credit Cards',
      subtitle: 'Limits, billing cycles and outstanding bills',
      icon: CreditCard,
      to: '/budget/cards',
    },
    {
      title: 'Investments',
      subtitle: 'Portfolio value, allocation and P&L',
      icon: TrendingUp,
      to: '/budget/investments',
    },
    {
      title: 'Metrics',
      subtitle: 'Monthly bank, card and investment summary',
      icon: BarChart3,
      to: '/budget/metrics',
    },
  ]

  return (
    <>
      <PageHeader
        title="Budget"
        subtitle="One place for accounts, cards and investments"
        actions={
          <button className="btn btn-sm btn-outline" onClick={() => setShowManage(true)}>
            <Settings2 size={16} /> Manage
          </button>
        }
      />

      <div className="grid-3" style={{ marginBottom: 16 }}>
        {statCards.map(({ label, value, icon: Icon, tone, to }) => (
          <div
            key={label}
            className="card stat-clickable"
            role="button"
            tabIndex={0}
            onClick={() => navigate(to)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate(to)
            }}
          >
            <Icon size={18} style={{ color: tone }} />
            <div className="stat-value" style={{ marginTop: 6, color: tone }}>
              {value}
            </div>
            <div className="stat-label muted">{label}</div>
          </div>
        ))}
      </div>

      <div className="stack" style={{ gap: 10, marginBottom: 20 }}>
        {navCards.map(({ title, subtitle, icon: Icon, to }) => (
          <button
            key={title}
            className="card clickable"
            style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', width: '100%', border: 'none' }}
            onClick={() => navigate(to)}
          >
            <div className="avatar primary">
              <Icon size={20} />
            </div>
            <div className="grow">
              <div className="bold">{title}</div>
              <div className="small muted">{subtitle}</div>
            </div>
            <span className="muted">›</span>
          </button>
        ))}
      </div>

      <div className="row-between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="section-label">Today&apos;s activity</div>
          <div className="tiny muted">
            Spent {formatMoney(todayTotals.spent)} · Earned {formatMoney(todayTotals.earned)}
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-sm btn-outline" onClick={() => setShowAdd('Income')}>
            <ArrowDownLeft size={14} /> Credit
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowAdd('Expense')}>
            <ArrowUpRight size={14} /> Spend
          </button>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/budget/activity')}>
            View all <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {recentActivity.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Wallet size={36} />}
            title="No activity today"
            subtitle="Spends and credits from today will appear here."
            action={
              <button className="btn btn-primary" onClick={() => setShowAdd('Expense')}>
                <Plus size={16} /> Add transaction
              </button>
            }
          />
        </div>
      ) : (
        <div className="card flush">
          <ActivityRows
            items={recentActivity}
            cardNameById={cardNameById}
            onEditBank={openEdit}
            onEditCard={setEditingCardTxn}
          />
        </div>
      )}

      <button className="fab" aria-label="Add transaction" onClick={() => setShowAdd('Expense')}>
        <Plus size={26} />
      </button>

      {showAdd && <TransactionDialog type={showAdd} onClose={() => setShowAdd(null)} />}
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
      {showManage && (
        <ManageSourcesCategoriesDialog
          sources={sources ?? []}
          categories={categories ?? []}
          onClose={() => setShowManage(false)}
        />
      )}
    </>
  )
}
