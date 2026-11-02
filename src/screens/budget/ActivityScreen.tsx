import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { List, Wallet } from 'lucide-react'
import { db } from '../../db/db'
import type { CreditCardTransaction, Transaction } from '../../db/types'
import { dailySummary, transferPair } from '../../db/budget'
import { endOfDay, startOfDay } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { EmptyState, PageHeader } from '../../components/ui'
import { ActivityRows, buildDailyActivity } from './ActivityList'
import { CardTransactionDialog, TransactionDialog } from './shared'

/** The whole current day's activity in local time; resets at midnight. */
export default function ActivityScreen() {
  const navigate = useNavigate()
  const transactions = useLiveQuery(async () => db.transactions.toArray(), [], [])
  const cardTxns = useLiveQuery(async () => db.creditCardTransactions.toArray(), [], [])
  const cards = useLiveQuery(async () => db.creditCards.toArray(), [], [])
  const [editingTxn, setEditingTxn] = useState<{ txn: Transaction; pair?: { from: string; to: string } } | null>(null)
  const [editingCardTxn, setEditingCardTxn] = useState<CreditCardTransaction | null>(null)

  const now = new Date()
  const start = startOfDay(now.getTime())
  const end = endOfDay(now.getTime())
  const activity = buildDailyActivity(transactions ?? [], cardTxns ?? [], start, end)
  const totals = dailySummary(transactions ?? [], cardTxns ?? [], start, end)
  const cardNameById = new Map((cards ?? []).map((c) => [c.id!, c.name]))

  const openBankEdit = (txn: Transaction) => {
    const pair = transferPair(transactions ?? [], txn)
    setEditingTxn({ txn, pair: pair ?? undefined })
  }

  return (
    <>
      <PageHeader
        title="Today's activity"
        subtitle={now.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
        onBack={() => navigate('/budget')}
        actions={
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/budget/transactions')}>
            <List size={16} /> All transactions
          </button>
        }
      />

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
      </div>

      {activity.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Wallet size={40} />}
            title="No activity today"
            subtitle="Spends, credits and card purchases from today will appear here."
          />
        </div>
      ) : (
        <>
          <div className="section-label" style={{ marginBottom: 8 }}>
            {activity.length} transaction{activity.length === 1 ? '' : 's'} · newest first
          </div>
          <div className="card flush">
            <ActivityRows
              items={activity}
              cardNameById={cardNameById}
              onEditBank={openBankEdit}
              onEditCard={setEditingCardTxn}
            />
          </div>
        </>
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
    </>
  )
}
