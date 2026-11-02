import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard as CardIcon,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { db } from '../../db/db'
import type { CardTxnType, CreditCard, CreditCardTransaction } from '../../db/types'
import {
  billingCycle,
  cardOutstanding,
  cardUsage,
  deleteCardCascade,
  deleteCardTransaction,
  payCardBill,
} from '../../db/budget'
import { formatDate } from '../../lib/dates'
import { formatMoney, ordinal } from '../../lib/format'
import {
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  MoneyInput,
  PageHeader,
  ProgressBar,
  Select,
  TextInput,
} from '../../components/ui'
import { CardTransactionDialog, Money, MonthYearPicker } from './shared'

export default function CreditCardDetailScreen() {
  const { cardId } = useParams()
  const id = Number(cardId)
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [addType, setAddType] = useState<CardTxnType | null>(null)
  const [showPay, setShowPay] = useState(false)
  const [deletingTxn, setDeletingTxn] = useState<CreditCardTransaction | null>(null)
  const [editingTxn, setEditingTxn] = useState<CreditCardTransaction | null>(null)

  const card = useLiveQuery(async () => (id ? ((await db.creditCards.get(id)) ?? null) : null), [id])
  const allTxns = useLiveQuery(async () => db.creditCardTransactions.toArray(), [], [])

  const cardTxns = useMemo(
    () => (allTxns ?? []).filter((t) => t.cardId === id),
    [allTxns, id],
  )
  const outstanding = cardOutstanding(cardTxns)
  const usage = card ? cardUsage(outstanding, card.creditLimit) : 0
  const available = card ? card.creditLimit - outstanding : 0
  const displayOutstanding = Math.max(0, outstanding)

  const cycle = card ? billingCycle(year, month, card.billingCycleDay) : null
  const filtered = useMemo(
    () => (cycle ? cardTxns.filter((t) => t.date >= cycle.start && t.date < cycle.end) : []),
    [cardTxns, cycle],
  )

  if (card === null) {
    return (
      <div className="card">
        <EmptyState
          icon={<CardIcon size={40} />}
          title="Card not found"
          subtitle="It may have been deleted."
          action={<button className="btn btn-primary" onClick={() => navigate('/budget/cards')}>Back to cards</button>}
        />
      </div>
    )
  }
  if (card === undefined) return <div className="empty">Loading…</div>

  return (
    <>
      <PageHeader
        title={card.name}
        subtitle={`Billing cycle: ${ordinal(card.billingCycleDay)} of each month`}
        onBack={() => navigate('/budget/cards')}
        actions={
          <>
            <button className="icon-btn" aria-label="Edit card" onClick={() => setShowEdit(true)}>
              <Pencil size={18} />
            </button>
            <button className="icon-btn" aria-label="Delete card" onClick={() => setShowDelete(true)}>
              <Trash2 size={18} color="var(--error)" />
            </button>
          </>
        }
      />

      <div className="hero" style={{ marginBottom: 16 }}>
        <div className="row-between">
          <div>
            <div className="hero-label">Credit limit</div>
            <div className="big-amount">{formatMoney(card.creditLimit)}</div>
          </div>
          <div className="align-end">
            <div className="hero-label">Outstanding</div>
            <div className="big-amount" style={{ color: outstanding > 0 ? 'var(--error)' : 'var(--success)' }}>
              {formatMoney(displayOutstanding)}
            </div>
            {outstanding < 0 && (
              <div className="tiny" style={{ color: 'var(--success)' }}>{formatMoney(-outstanding)} credit</div>
            )}
          </div>
        </div>
        <div className="hero-row">
          <div>
            <div className="hero-label">Available</div>
            <div className="bold">{formatMoney(available)}</div>
          </div>
          <div>
            <div className="hero-label">Utilization</div>
            <div className="bold">{Math.round(usage * 100)}%</div>
          </div>
          <div>
            <div className="hero-label">Purchases</div>
            <div className="bold">{formatMoney(cardTxns.filter((t) => t.type === 'Purchase').reduce((s, t) => s + t.amount, 0))}</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <ProgressBar value={usage} color={usage >= 0.7 ? 'var(--error)' : 'var(--primary)'} />
        </div>
      </div>

      <div className="row-between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <MonthYearPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-sm btn-outline" onClick={() => setAddType('Credit')}>
            <ArrowDownLeft size={14} /> Credit
          </button>
          <button className="btn btn-sm btn-outline" onClick={() => setAddType('Purchase')}>
            <ArrowUpRight size={14} /> Spend
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowPay(true)}>
            <Wallet size={14} /> Pay bill
          </button>
        </div>
      </div>

      {cycle && (
        <p className="small muted" style={{ marginBottom: 12 }}>
          Cycle: {cycle.startLabel} – {cycle.endLabel}
        </p>
      )}

      <div className="card flush">
        {filtered.length === 0 ? (
          <div className="empty">
            <CardIcon size={32} />
            <div className="bold" style={{ color: 'var(--text)' }}>No transactions in this cycle</div>
            <div className="small">Add a spend or credit to get started.</div>
          </div>
        ) : (
          filtered
            .slice()
            .sort((a, b) => b.date - a.date)
            .map((t, i) => (
              <div
                key={t.id}
                className="row"
                style={{ padding: '12px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--outline)' }}
              >
                <div className={`avatar ${t.type === 'Purchase' ? 'error' : 'primary'}`} style={{ width: 34, height: 34 }}>
                  {t.type === 'Purchase' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                </div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="truncate">{t.description || t.type}</div>
                  <div className="tiny muted">
                    {t.type} · {formatDate(t.date)}
                  </div>
                </div>
                <Money value={t.type === 'Purchase' ? -t.amount : t.amount} />
                {t.linkedTransactionId == null && (
                  <button
                    className="icon-btn"
                    style={{ width: 30, height: 30 }}
                    aria-label="Edit transaction"
                    onClick={() => setEditingTxn(t)}
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label="Delete transaction" onClick={() => setDeletingTxn(t)}>
                  <X size={15} color="var(--error)" />
                </button>
              </div>
            ))
        )}
      </div>

      <button className="fab" aria-label="Add card transaction" onClick={() => setAddType('Purchase')}>
        <Plus size={26} />
      </button>

      {addType && <CardTransactionDialog type={addType} cardId={card.id!} onClose={() => setAddType(null)} />}
      {editingTxn && (
        <CardTransactionDialog
          cardId={card.id!}
          transaction={editingTxn}
          onClose={() => setEditingTxn(null)}
        />
      )}
      {showPay && <PayBillDialog card={card} onClose={() => setShowPay(false)} />}
      {showEdit && <EditCardDialog card={card} onClose={() => setShowEdit(false)} />}

      <ConfirmDialog
        open={deletingTxn != null}
        title="Delete Transaction"
        message="Delete this card transaction? A linked bank bill payment is removed too."
        onCancel={() => setDeletingTxn(null)}
        onConfirm={async () => {
          if (deletingTxn?.id != null) await deleteCardTransaction(deletingTxn.id)
          setDeletingTxn(null)
        }}
      />
      <ConfirmDialog
        open={showDelete}
        title="Delete Card"
        message={`Delete "${card.name}"? All card transactions and linked bill payments will be removed.`}
        onCancel={() => setShowDelete(false)}
        onConfirm={async () => {
          await deleteCardCascade(card.id!)
          navigate('/budget/cards')
        }}
      />
    </>
  )
}

function PayBillDialog({ card, onClose }: { card: CreditCard; onClose: () => void }) {
  const sources = useLiveQuery(async () => db.sources.toArray(), [], [])
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const amountValue = Number(amount)
  const valid = Number.isFinite(amountValue) && amountValue > 0 && source !== ''

  const save = async () => {
    if (!valid) return
    try {
      await payCardBill({
        cardId: card.id!,
        amount: amountValue,
        source,
        description: description || `Payment to ${card.name}`,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record payment')
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Pay ${card.name} bill`}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!valid}>Pay</button>
        </div>
      }
    >
      <div className="stack">
        <p className="small muted">
          This creates a card payment and a matching bank expense, so both balances stay in sync.
        </p>
        <Field label="Amount *">
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
        </Field>
        <Field label="Pay from *">
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Select account…</option>
            {(sources ?? []).map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Description">
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder={`Payment to ${card.name}`} />
        </Field>
        {error && <p className="tiny" style={{ color: 'var(--error)' }}>{error}</p>}
        {(sources ?? []).length === 0 && (
          <p className="tiny" style={{ color: 'var(--warning)' }}>Add a bank account first.</p>
        )}
      </div>
    </Dialog>
  )
}

function EditCardDialog({ card, onClose }: { card: CreditCard; onClose: () => void }) {
  const [name, setName] = useState(card.name)
  const [limit, setLimit] = useState(String(card.creditLimit))
  const [cycleDay, setCycleDay] = useState(String(card.billingCycleDay))
  const [error, setError] = useState('')
  const limitValue = Number(limit)
  const dayValue = Number(cycleDay)
  const valid = name.trim() !== '' && limitValue > 0 && Number.isInteger(dayValue) && dayValue >= 1 && dayValue <= 31

  const save = async () => {
    if (!valid) return
    const existing = await db.creditCards.toArray()
    if (existing.some((c) => c.id !== card.id && c.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      setError('A card with that name already exists')
      return
    }
    await db.creditCards.update(card.id!, {
      name: name.trim(),
      creditLimit: limitValue,
      billingCycleDay: dayValue,
    })
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit Credit Card"
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!valid}>Save</button>
        </div>
      }
    >
      <div className="stack">
        <Field label="Card name *">
          <TextInput autoFocus value={name} onChange={(e) => { setName(e.target.value); setError('') }} />
        </Field>
        <Field label="Credit limit *">
          <MoneyInput value={limit} onChange={setLimit} label="Credit limit" />
        </Field>
        <Field label="Billing cycle day (1–31) *">
          <TextInput type="number" inputMode="numeric" min={1} max={31} value={cycleDay} onChange={(e) => setCycleDay(e.target.value)} />
        </Field>
        {error && <p className="tiny" style={{ color: 'var(--error)' }}>{error}</p>}
      </div>
    </Dialog>
  )
}
