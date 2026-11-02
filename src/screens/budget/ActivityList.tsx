import { ArrowDownLeft, ArrowUpRight, CreditCard, Pencil } from 'lucide-react'
import type { CreditCardTransaction, Transaction } from '../../db/types'
import { formatTime } from '../../lib/dates'
import { formatMoney } from '../../lib/format'

export type ActivityItem =
  | { kind: 'bank'; date: number; createdAt: number; bank: Transaction }
  | { kind: 'card'; date: number; createdAt: number; card: CreditCardTransaction }

/**
 * Everything that happened in the local-time window [start, end], newest first.
 * The card side of a bill payment is skipped because its bank expense row is
 * already present.
 */
export function buildDailyActivity(
  transactions: Transaction[],
  cardTransactions: CreditCardTransaction[],
  start: number,
  end: number,
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...transactions
      .filter((t) => t.date >= start && t.date <= end)
      .map((t) => ({ kind: 'bank' as const, date: t.date, createdAt: t.createdAt, bank: t })),
    ...cardTransactions
      .filter((t) => t.date >= start && t.date <= end)
      .filter((t) => !(t.type === 'Payment' && t.linkedTransactionId != null))
      .map((t) => ({ kind: 'card' as const, date: t.date, createdAt: t.createdAt, card: t })),
  ]

  return items.sort(sortActivity)
}

/** Most recent first; same-timestamp entries fall back to creation time, then id. */
export function sortActivity(a: ActivityItem, b: ActivityItem): number {
  if (b.date !== a.date) return b.date - a.date
  if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt
  const aId = a.kind === 'bank' ? a.bank.id ?? 0 : a.card.id ?? 0
  const bId = b.kind === 'bank' ? b.bank.id ?? 0 : b.card.id ?? 0
  return bId - aId
}

export function ActivityRows({
  items,
  cardNameById,
  onEditBank,
  onEditCard,
}: {
  items: ActivityItem[]
  cardNameById: Map<number, string>
  onEditBank: (txn: Transaction) => void
  onEditCard: (txn: CreditCardTransaction) => void
}) {
  return (
    <>
      {items.map((item, i) => {
        const borderTop = i === 0 ? 'none' : '1px solid var(--outline)'
        if (item.kind === 'bank') {
          const txn = item.bank
          return (
            <div key={`bank-${txn.id}`} className="row" style={{ padding: '12px 16px', borderTop }}>
              <div className={`avatar ${txn.type === 'Income' ? 'primary' : 'error'}`} style={{ width: 34, height: 34 }}>
                {txn.type === 'Income' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
              </div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="truncate">{txn.description || txn.category || txn.type}</div>
                <div className="tiny muted">
                  {txn.source} · {txn.category} · {formatTime(txn.date)}
                </div>
              </div>
              <span className={txn.type === 'Income' ? 'money-positive' : 'money-negative'}>
                {txn.type === 'Income' ? '+' : '−'}
                {formatMoney(txn.amount)}
              </span>
              {txn.linkedCardTxnId == null && (
                <button
                  className="icon-btn"
                  style={{ width: 30, height: 30 }}
                  aria-label="Edit transaction"
                  onClick={() => onEditBank(txn)}
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          )
        }

        const txn = item.card
        const spent = txn.type === 'Purchase'
        return (
          <div key={`card-${txn.id}`} className="row" style={{ padding: '12px 16px', borderTop }}>
            <div className={`avatar ${spent ? 'error' : 'primary'}`} style={{ width: 34, height: 34 }}>
              <CreditCard size={16} />
            </div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="truncate">{txn.description || txn.type}</div>
              <div className="tiny muted">
                {cardNameById.get(txn.cardId) ?? 'Card'} · {txn.type} · {formatTime(txn.date)}
              </div>
            </div>
            <span className={spent ? 'money-negative' : 'money-positive'}>
              {spent ? '−' : '+'}
              {formatMoney(txn.amount)}
            </span>
            {txn.linkedTransactionId == null && (
              <button
                className="icon-btn"
                style={{ width: 30, height: 30 }}
                aria-label="Edit card transaction"
                onClick={() => onEditCard(txn)}
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        )
      })}
    </>
  )
}
