import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { CreditCard, Plus, Trash2 } from 'lucide-react'
import { db } from '../../db/db'
import type { CreditCard as Card } from '../../db/types'
import { cardOutstanding, cardUsage, deleteCardCascade } from '../../db/budget'
import { formatMoney } from '../../lib/format'
import { ordinal } from '../../lib/format'
import { ConfirmDialog, Dialog, EmptyState, Field, PageHeader, ProgressBar, TextInput } from '../../components/ui'

export default function CreditCardsScreen() {
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [deleting, setDeleting] = useState<Card | null>(null)

  const cards = useLiveQuery(async () => db.creditCards.toArray(), [], [])
  const txns = useLiveQuery(async () => db.creditCardTransactions.toArray(), [], [])

  return (
    <>
      <PageHeader
        title="Credit Cards"
        subtitle="Limits, outstanding bills and billing cycles"
        onBack={() => navigate('/budget')}
        actions={
          <button className="btn btn-sm btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Card
          </button>
        }
      />

      {(cards ?? []).length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<CreditCard size={40} />}
            title="No credit cards yet"
            subtitle="Add a card to track spends, payments and available limit."
            action={
              <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> Add card
              </button>
            }
          />
        </div>
      ) : (
        <div className="stack">
          {(cards ?? []).map((card) => {
            const outstanding = cardOutstanding((txns ?? []).filter((t) => t.cardId === card.id))
            const available = card.creditLimit - outstanding
            const usage = cardUsage(outstanding, card.creditLimit)
            const displayOutstanding = Math.max(0, outstanding)
            return (
              <div
                key={card.id}
                className="card clickable"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/budget/cards/${card.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') navigate(`/budget/cards/${card.id}`)
                }}
              >
                <div className="row-between">
                  <div className="row grow" style={{ minWidth: 0 }}>
                    <div className="avatar primary">
                      <CreditCard size={19} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="bold truncate">{card.name}</div>
                      <div className="small muted">Billing cycle: {ordinal(card.billingCycleDay)} of the month</div>
                    </div>
                  </div>
                  <button
                    className="icon-btn"
                    aria-label={`Delete ${card.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleting(card)
                    }}
                  >
                    <Trash2 size={17} color="var(--error)" />
                  </button>
                </div>

                <div className="hero-row" style={{ marginTop: 14 }}>
                  <div>
                    <div className="hero-label">Limit</div>
                    <div className="bold">{formatMoney(card.creditLimit)}</div>
                  </div>
                  <div>
                    <div className="hero-label">Outstanding</div>
                    <div className="bold" style={{ color: outstanding > 0 ? 'var(--error)' : 'var(--success)' }}>
                      {formatMoney(displayOutstanding)}
                    </div>
                    {outstanding < 0 && (
                      <div className="tiny" style={{ color: 'var(--success)' }}>{formatMoney(-outstanding)} credit</div>
                    )}
                  </div>
                  <div>
                    <div className="hero-label">Available</div>
                    <div className="bold" style={{ color: available < 0 ? 'var(--error)' : 'var(--success)' }}>
                      {formatMoney(available)}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <ProgressBar value={usage} color={usage >= 0.7 ? 'var(--error)' : 'var(--primary)'} />
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    {Math.round(usage * 100)}% utilized
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button className="fab" aria-label="Add credit card" onClick={() => setShowAdd(true)}>
        <Plus size={26} />
      </button>

      {showAdd && <AddCardDialog onClose={() => setShowAdd(false)} />}

      <ConfirmDialog
        open={deleting != null}
        title="Delete Card"
        message={`Delete "${deleting?.name}"? All transactions for this card, and any bank bill payments linked to it, will be removed.`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting?.id != null) await deleteCardCascade(deleting.id)
          setDeleting(null)
        }}
      />
    </>
  )
}

function AddCardDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [limit, setLimit] = useState('')
  const [cycleDay, setCycleDay] = useState('1')
  const [error, setError] = useState('')

  const limitValue = Number(limit)
  const dayValue = Number(cycleDay)
  const valid = name.trim() !== '' && Number.isFinite(limitValue) && limitValue > 0 && Number.isInteger(dayValue) && dayValue >= 1 && dayValue <= 31

  const save = async () => {
    if (!valid) return
    const existing = await db.creditCards.toArray()
    if (existing.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      setError('A card with that name already exists')
      return
    }
    await db.creditCards.add({
      name: name.trim(),
      creditLimit: limitValue,
      billingCycleDay: dayValue,
      createdAt: Date.now(),
    })
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add Credit Card"
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!valid}>Add</button>
        </div>
      }
    >
      <div className="stack">
        <Field label="Card name *">
          <TextInput autoFocus value={name} onChange={(e) => { setName(e.target.value); setError('') }} placeholder="e.g. HDFC Regalia" />
        </Field>
        <Field label="Credit limit *">
          <TextInput type="number" inputMode="decimal" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Billing cycle day (1–31) *" hint="Short months clamp to their last day.">
          <TextInput type="number" inputMode="numeric" min={1} max={31} value={cycleDay} onChange={(e) => setCycleDay(e.target.value)} />
        </Field>
        {error && <p className="tiny" style={{ color: 'var(--error)' }}>{error}</p>}
      </div>
    </Dialog>
  )
}
