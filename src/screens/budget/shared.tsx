import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search, Trash2 } from 'lucide-react'
import { db } from '../../db/db'
import type {
  CardTxnType,
  Category,
  CreditCard,
  CreditCardTransaction,
  Source,
  Transaction,
  TransactionType,
} from '../../db/types'
import { MONTHS, MONTHS_SHORT, toDateKey } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import {
  Dialog,
  Field,
  IconButton,
  MoneyInput,
  TextInput,
} from '../../components/ui'
import {
  addExpense,
  addIncome,
  addSelfTransfer,
  cardNameExists,
  categoryNameExists,
  deleteCardCascade,
  deleteCategory,
  deleteSource,
  recordCardTransaction,
  renameCategory,
  renameSource,
  SELF_TRANSFER_CATEGORY,
  sourceNameExists,
  updateSelfTransfer,
  updateTransaction,
} from '../../db/budget'

/** Today's entries keep the current time; other dates are stored at local noon. */
function resolveWhen(date: string, existing?: number): number {
  const todayKey = toDateKey(new Date())
  if (date !== todayKey) return new Date(`${date}T12:00:00`).getTime()
  if (existing != null && toDateKey(existing) === todayKey) return existing
  return Date.now()
}

export function Money({
  value,
  tone,
}: {
  value: number
  tone?: 'auto' | 'plain'
}) {
  const cls =
    tone === 'plain' ? 'money-neutral' : value > 0 ? 'money-positive' : value < 0 ? 'money-negative' : 'money-neutral'
  return <span className={cls}>{formatMoney(value)}</span>
}

export function MonthYearPicker({
  year,
  month,
  onChange,
  years,
}: {
  year: number
  month: number
  onChange: (year: number, month: number) => void
  years?: number[]
}) {
  const now = new Date().getFullYear()
  const options = years ?? Array.from({ length: 21 }, (_, i) => now - 10 + i)
  return (
    <div className="month-year">
      <select
        className="select"
        aria-label="Month"
        value={month}
        onChange={(e) => onChange(year, Number(e.target.value))}
      >
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        className="select"
        aria-label="Year"
        value={year}
        onChange={(e) => onChange(Number(e.target.value), month)}
      >
        {options.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Multi-select month + year filter used by the accounts and card-spend lists. */
export function MultiMonthYearFilter({
  months,
  years,
  onMonths,
  onYears,
  allYears,
}: {
  months: Set<number>
  years: Set<number>
  onMonths: (next: Set<number>) => void
  onYears: (next: Set<number>) => void
  allYears: number[]
}) {
  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="toolbar">
        <span className="small muted">Months</span>
        <div className="chip-row wrap">
          <button className="chip" onClick={() => onMonths(new Set(Array.from({ length: 12 }, (_, i) => i + 1)))}>
            All
          </button>
          <button className="chip" onClick={() => onMonths(new Set())}>
            None
          </button>
          {MONTHS_SHORT.map((name, i) => (
            <button
              key={name}
              className={`chip ${months.has(i + 1) ? 'active' : ''}`}
              onClick={() => onMonths(toggle(months, i + 1))}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar">
        <span className="small muted">Years</span>
        <div className="chip-row wrap">
          <button className="chip" onClick={() => onYears(new Set(allYears))}>
            All
          </button>
          <button className="chip" onClick={() => onYears(new Set())}>
            None
          </button>
          {allYears.map((y) => (
            <button key={y} className={`chip ${years.has(y) ? 'active' : ''}`} onClick={() => onYears(toggle(years, y))}>
              {y}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

type ItemKind = 'source' | 'category' | 'card'

export function ManageSourcesCategoriesDialog({
  sources,
  categories,
  onClose,
}: {
  sources: Source[]
  categories: Category[]
  onClose: () => void
}) {
  const [tab, setTab] = useState<ItemKind>('source')
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<{ kind: ItemKind; id: number; name: string } | null>(null)
  const [deleting, setDeleting] = useState<{ kind: ItemKind; id: number; name: string } | null>(null)
  const [error, setError] = useState('')

  // Load cards here so callers don't have to pass them just for this dialog.
  const cards = useLiveQuery(async () => db.creditCards.toArray(), [], [])
  const cardList: CreditCard[] = cards ?? []

  useEffect(() => {
    if (tab === 'card' && cardList.length === 0) setTab('source')
  }, [tab, cardList.length])

  const items = useMemo(() => {
    const list =
      tab === 'source'
        ? sources.map((s) => ({ id: s.id!, name: s.name, meta: formatMoney(s.balance) }))
        : tab === 'category'
          ? categories.map((c) => ({ id: c.id!, name: c.name, meta: c.isDefault ? 'Default' : '' }))
          : cardList.map((c) => ({ id: c.id!, name: c.name, meta: `${formatMoney(c.creditLimit)} limit` }))
    const q = search.trim().toLowerCase()
    return list.filter((item) => !q || item.name.toLowerCase().includes(q))
  }, [tab, sources, categories, cardList, search])

  const add = async () => {
    const value = name.trim()
    if (!value || tab === 'card') return
    if (tab === 'source') {
      if (await sourceNameExists(value)) {
        setError('An account with that name already exists')
        return
      }
      await db.sources.add({ name: value, balance: 0, isDefault: false, createdAt: Date.now() })
    } else {
      if (await categoryNameExists(value)) {
        setError('A category with that name already exists')
        return
      }
      await db.categories.add({ name: value, isDefault: false, createdAt: Date.now() })
    }
    setName('')
    setError('')
  }

  const saveRename = async () => {
    if (!editing) return
    const value = editing.name.trim()
    if (!value) return
    if (editing.kind === 'source') {
      if (await sourceNameExists(value, editing.id)) {
        setError('An account with that name already exists')
        return
      }
      await renameSource(editing.id, value)
    } else if (editing.kind === 'category') {
      if (await categoryNameExists(value, editing.id)) {
        setError('A category with that name already exists')
        return
      }
      await renameCategory(editing.id, value)
    } else {
      if (await cardNameExists(value, editing.id)) {
        setError('A card with that name already exists')
        return
      }
      await db.creditCards.update(editing.id, { name: value })
    }
    setEditing(null)
    setError('')
  }

  return (
    <>
      <Dialog open onClose={onClose} title="Manage Accounts & Categories" footer={<button className="btn btn-primary btn-block" onClick={onClose}>Done</button>}>
        <div className="tab-row">
          <button className={tab === 'source' ? 'active' : ''} onClick={() => { setTab('source'); setSearch('') }}>
            Accounts ({sources.length})
          </button>
          <button className={tab === 'category' ? 'active' : ''} onClick={() => { setTab('category'); setSearch('') }}>
            Categories ({categories.length})
          </button>
          {cardList.length > 0 && (
            <button className={tab === 'card' ? 'active' : ''} onClick={() => { setTab('card'); setSearch('') }}>
              Cards ({cardList.length})
            </button>
          )}
        </div>

        {tab === 'card' ? (
          <p className="tiny muted">Rename or delete a card here. Add new cards from the Credit Cards screen.</p>
        ) : (
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <TextInput
                autoFocus
                value={name}
                placeholder={tab === 'source' ? 'New account name' : 'New category name'}
                onChange={(e) => { setName(e.target.value); setError('') }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void add()
                }}
              />
            </div>
            <button className="btn btn-primary" onClick={() => void add()} disabled={!name.trim()}>
              <Plus size={18} /> Add
            </button>
          </div>
        )}
        {error && <p className="tiny" style={{ color: 'var(--error)', marginTop: 6 }}>{error}</p>}

        <div className="search" style={{ marginTop: 12 }}>
          <Search size={16} />
          <input
            className="input"
            placeholder={`Search ${tab === 'source' ? 'accounts' : tab === 'category' ? 'categories' : 'cards'}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 8, maxHeight: 300, overflowY: 'auto' }}>
          {items.length === 0 ? (
            <p className="small muted" style={{ padding: '12px 0' }}>
              No {tab === 'source' ? 'accounts' : tab === 'category' ? 'categories' : 'cards'} yet.
            </p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="list-row tight">
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="truncate">{item.name}</div>
                  {item.meta && <div className="tiny muted">{item.meta}</div>}
                </div>
                <button className="btn btn-sm btn-outline" onClick={() => setEditing({ kind: tab, id: item.id, name: item.name })}>
                  Rename
                </button>
                <IconButton
                  label={`Delete ${item.name}`}
                  style={{ width: 32, height: 32 }}
                  onClick={() => setDeleting({ kind: tab, id: item.id, name: item.name })}
                >
                  <Trash2 size={16} color="var(--error)" />
                </IconButton>
              </div>
            ))
          )}
        </div>
      </Dialog>

      <Dialog
        open={editing != null}
        onClose={() => setEditing(null)}
        title="Rename"
        footer={
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void saveRename()} disabled={!editing?.name.trim()}>Save</button>
          </div>
        }
      >
        <Field label="Name">
          <TextInput
            autoFocus
            value={editing?.name ?? ''}
            onChange={(e) => editing && setEditing({ ...editing, name: e.target.value })}
          />
        </Field>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          {editing?.kind === 'card'
            ? 'The card name is used across the app.'
            : 'Renaming updates every existing transaction so totals stay consistent.'}
        </p>
      </Dialog>

      <Dialog
        open={deleting != null}
        onClose={() => setDeleting(null)}
        title={`Delete ${
          deleting?.kind === 'source' ? 'Account' : deleting?.kind === 'category' ? 'Category' : 'Credit Card'
        }`}
        footer={
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setDeleting(null)}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                if (!deleting) return
                if (deleting.kind === 'source') await deleteSource(deleting.id)
                else if (deleting.kind === 'category') await deleteCategory(deleting.id)
                else await deleteCardCascade(deleting.id)
                setDeleting(null)
              }}
            >
              Delete
            </button>
          </div>
        }
      >
        <p className="muted">
          {deleting?.kind === 'card'
            ? `Delete "${deleting?.name}"? Its card transactions and any linked bill payments will be removed.`
            : `Delete "${deleting?.name}"? Existing transactions keep their label and stay in the totals.`}
        </p>
      </Dialog>
    </>
  )
}

export function TransactionDialog({
  type: initialType,
  source,
  transaction,
  transferFrom,
  transferTo: initialTransferTo,
  onClose,
}: {
  type?: TransactionType
  source?: string
  transaction?: Transaction
  transferFrom?: string
  transferTo?: string
  onClose: () => void
}) {
  const editing = transaction != null
  const editingTransfer = transaction?.transferGroupId != null
  const [type, setType] = useState<TransactionType>(transaction?.type ?? initialType ?? 'Expense')
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '')
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [category, setCategory] = useState(transaction?.category ?? '')
  const [payment, setPayment] = useState<
    { kind: 'bank'; name: string } | { kind: 'card'; id: number } | null
  >(
    editingTransfer
      ? transferFrom
        ? { kind: 'bank', name: transferFrom }
        : null
      : transaction
        ? { kind: 'bank', name: transaction.source }
        : source
          ? { kind: 'bank', name: source }
          : null,
  )
  const [transferTo, setTransferTo] = useState(initialTransferTo ?? '')
  const [date, setDate] = useState(transaction ? toDateKey(transaction.date) : toDateKey(new Date()))
  const [error, setError] = useState('')

  const sources = useLiveQuery(async () => db.sources.toArray(), [], [])
  const categories = useLiveQuery(async () => db.categories.toArray(), [], [])
  const cards = useLiveQuery(async () => db.creditCards.toArray(), [], [])
  const sourceList = sources ?? []
  const categoryList = categories ?? []
  const cardList = cards ?? []

  const categoryOptions = categoryList.some((c) => c.name === SELF_TRANSFER_CATEGORY)
    ? categoryList.map((c) => c.name)
    : [...categoryList.map((c) => c.name), SELF_TRANSFER_CATEGORY]

  const amountValue = Number(amount)
  const bankSource = payment?.kind === 'bank' ? payment.name : ''
  const addTransfer =
    !editing && type === 'Expense' && category === SELF_TRANSFER_CATEGORY && bankSource !== ''
  const transferUI = editingTransfer || addTransfer
  const transferTargets = sourceList.filter((s) => s.name !== bankSource)

  const valid =
    amount.trim() !== '' &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    payment != null &&
    (transferUI
      ? transferTo !== '' && transferTo !== bankSource
      : type === 'Income' || payment.kind === 'card' || category !== '')

  const save = async () => {
    if (!valid || payment == null) return
    const when = resolveWhen(date, transaction?.date)
    try {
      if (editingTransfer && transaction?.transferGroupId) {
        await updateSelfTransfer(transaction.transferGroupId, {
          fromSource: bankSource,
          toSource: transferTo,
          amount: amountValue,
          description,
          date: when,
        })
      } else if (addTransfer) {
        await addSelfTransfer({
          fromSource: bankSource,
          toSource: transferTo,
          amount: amountValue,
          description,
          date: when,
        })
      } else if (editing && transaction) {
        await updateTransaction(transaction, {
          type,
          amount: amountValue,
          category,
          source: bankSource,
          description,
          date: when,
        })
      } else if (payment.kind === 'bank') {
        if (type === 'Income') {
          await addIncome({ amount: amountValue, source: payment.name, category: category || 'Income', description, date: when })
        } else {
          await addExpense({ amount: amountValue, source: payment.name, category, description, date: when })
        }
      } else {
        const card = cardList.find((c) => c.id === payment.id)
        await recordCardTransaction(
          payment.id,
          type === 'Income' ? 'Credit' : 'Purchase',
          amountValue,
          description || card?.name || 'Card transaction',
          when,
        )
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    }
  }

  const title = editingTransfer
    ? 'Edit Transfer'
    : editing
      ? type === 'Income'
        ? 'Edit Credit'
        : 'Edit Spend'
      : type === 'Income'
        ? 'Add Credit'
        : 'Add Spend'

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!valid}>
            {editing ? 'Save' : 'Add'}
          </button>
        </div>
      }
    >
      <div className="stack">
        {!editingTransfer && (
          <div className="chip-row wrap">
            {(['Expense', 'Income'] as TransactionType[]).map((t) => (
              <button
                key={t}
                className={`chip ${type === t ? 'active' : ''}`}
                onClick={() => {
                  setType(t)
                  if (t === 'Income') setTransferTo('')
                }}
              >
                {t === 'Expense' ? 'Spend' : 'Credit'}
              </button>
            ))}
          </div>
        )}

        <Field label="Amount *">
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
        </Field>
        <Field label="Description">
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        {!editingTransfer && type === 'Expense' && payment?.kind !== 'card' && (
          <Field label="Category *">
            <div className="chip-row wrap">
              {categoryOptions.map((name) => (
                <button
                  key={name}
                  className={`chip ${category === name ? 'active' : ''}`}
                  onClick={() => {
                    setCategory(name)
                    if (name !== SELF_TRANSFER_CATEGORY) setTransferTo('')
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            {categoryList.length === 0 && (
              <span className="tiny muted">Add a category from Accounts → Manage first.</span>
            )}
          </Field>
        )}

        {editingTransfer && (
          <Field label="From account *">
            <div className="chip-row wrap">
              {sourceList.map((s) => (
                <button
                  key={`from-${s.id}`}
                  className={`chip ${payment?.kind === 'bank' && payment.name === s.name ? 'active' : ''}`}
                  onClick={() => setPayment({ kind: 'bank', name: s.name })}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </Field>
        )}

        {transferUI && (
          <Field label="Transfer to *">
            <div className="chip-row wrap">
              {transferTargets.map((s) => (
                <button
                  key={`to-${s.id}`}
                  className={`chip ${transferTo === s.name ? 'active' : ''}`}
                  onClick={() => setTransferTo(s.name)}
                >
                  {s.name}
                </button>
              ))}
            </div>
            {transferTargets.length === 0 && (
              <span className="tiny muted">Add a second bank account to transfer between.</span>
            )}
          </Field>
        )}

        {!editingTransfer && (
          <Field label={editing ? 'Bank account *' : 'Account or card *'}>
            <div className="stack" style={{ gap: 8 }}>
              {sourceList.length > 0 && (
                <div>
                  {!editing && <div className="tiny muted" style={{ marginBottom: 4 }}>Bank accounts</div>}
                  <div className="chip-row wrap">
                    {sourceList.map((s) => (
                      <button
                        key={`bank-${s.id}`}
                        className={`chip ${payment?.kind === 'bank' && payment.name === s.name ? 'active' : ''}`}
                        onClick={() => setPayment({ kind: 'bank', name: s.name })}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!editing && cardList.length > 0 && (
                <div>
                  <div className="tiny muted" style={{ marginBottom: 4 }}>Credit cards</div>
                  <div className="chip-row wrap">
                    {cardList.map((c) => (
                      <button
                        key={`card-${c.id}`}
                        className={`chip ${payment?.kind === 'card' && payment.id === c.id ? 'active' : ''}`}
                        onClick={() => {
                          setPayment({ kind: 'card', id: c.id! })
                          setCategory('')
                          setTransferTo('')
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {sourceList.length === 0 && (editing || cardList.length === 0) && (
                <span className="tiny muted">
                  Add a bank account{editing ? '' : ' or credit card'} first.
                </span>
              )}
            </div>
          </Field>
        )}

        {payment?.kind === 'card' && (
          <p className="tiny muted">
            Recorded on {cardList.find((c) => c.id === payment.id)?.name ?? 'the card'} — it appears in the card&apos;s
            activity and outstanding balance.
          </p>
        )}

        {transferUI && (
          <p className="tiny muted">
            Both accounts update together, and the transfer is excluded from spending and income totals.
          </p>
        )}

        {error && <p className="tiny" style={{ color: 'var(--error)' }}>{error}</p>}
      </div>
    </Dialog>
  )
}

/** Add or edit a credit-card transaction (purchase, credit or payment). */
export function CardTransactionDialog({
  cardId,
  type: initialType = 'Purchase',
  transaction,
  onClose,
}: {
  cardId: number
  type?: CardTxnType
  transaction?: CreditCardTransaction
  onClose: () => void
}) {
  const editing = transaction != null
  // A bill payment is linked to a bank expense; editing one side would desync.
  const linked = transaction?.linkedTransactionId != null
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '')
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [date, setDate] = useState(transaction ? toDateKey(transaction.date) : toDateKey(new Date()))
  const [typeValue, setTypeValue] = useState<CardTxnType>(transaction?.type ?? initialType)
  const amountValue = Number(amount)
  const valid = Number.isFinite(amountValue) && amountValue > 0 && !linked

  const save = async () => {
    if (!valid) return
    const payload = {
      cardId,
      amount: amountValue,
      description: description.trim(),
      date: resolveWhen(date, transaction?.date),
      type: typeValue,
    }
    if (editing && transaction?.id != null) {
      await db.creditCardTransactions.update(transaction.id, payload)
    } else {
      await db.creditCardTransactions.add({ ...payload, createdAt: Date.now() })
    }
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? `Edit ${typeValue}` : `Add ${typeValue}`}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!valid}>
            {editing ? 'Save' : 'Add'}
          </button>
        </div>
      }
    >
      <div className="stack">
        <div className="chip-row">
          {(['Purchase', 'Credit', 'Payment'] as CardTxnType[]).map((t) => (
            <button
              key={t}
              className={`chip ${typeValue === t ? 'active' : ''}`}
              onClick={() => setTypeValue(t)}
              disabled={linked}
            >
              {t}
            </button>
          ))}
        </div>
        <Field label="Amount *">
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
        </Field>
        <Field label="Description">
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {linked && (
          <p className="tiny muted">This is the card side of a bill payment. Delete it from either side instead of editing.</p>
        )}
        {typeValue === 'Payment' && !linked && (
          <p className="tiny muted">
            Recording a payment here only reduces the card balance. Use &quot;Pay bill&quot; to also deduct it from a bank account.
          </p>
        )}
      </div>
    </Dialog>
  )
}
