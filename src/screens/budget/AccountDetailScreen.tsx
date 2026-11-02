import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronDown,
  ChevronUp,
  Landmark,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import { db } from '../../db/db'
import type { Source, Transaction, TransactionType } from '../../db/types'
import { deleteSource, deleteTransactionCascade, transferPair } from '../../db/budget'
import { formatDate, monthRange } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import {
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  MoneyInput,
  PageHeader,
  TextInput,
} from '../../components/ui'
import { ManageSourcesCategoriesDialog, Money, MonthYearPicker, TransactionDialog } from './shared'

export default function AccountDetailScreen() {
  const { sourceId } = useParams()
  const id = Number(sourceId)
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [showManage, setShowManage] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deletingTxn, setDeletingTxn] = useState<Transaction | null>(null)
  const [editingTxn, setEditingTxn] = useState<{ txn: Transaction; pair?: { from: string; to: string } } | null>(null)
  const [addType, setAddType] = useState<TransactionType | null>(null)
  const [creditsOpen, setCreditsOpen] = useState(true)
  const [spendsOpen, setSpendsOpen] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set())

  const source = useLiveQuery(async () => (id ? ((await db.sources.get(id)) ?? null) : null), [id])
  const transactions = useLiveQuery(async () => db.transactions.toArray(), [], [])
  const categories = useLiveQuery(async () => db.categories.toArray(), [], [])
  const sources = useLiveQuery(async () => db.sources.toArray(), [], [])

  const [start, end] = monthRange(year, month)
  const monthTxns = useMemo(
    () =>
      (transactions ?? []).filter(
        (t) =>
          t.source === source?.name &&
          t.date >= start &&
          t.date <= end &&
          (categoryFilter.size === 0 || categoryFilter.has(t.category)),
      ),
    [transactions, source?.name, start, end, categoryFilter],
  )
  const income = monthTxns.filter((t) => t.type === 'Income')
  const expenses = monthTxns.filter((t) => t.type === 'Expense')
  const totalIncome = income.reduce((s, t) => s + t.amount, 0)
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0)

  const openEdit = (txn: Transaction) => {
    const pair = transferPair(transactions ?? [], txn)
    setEditingTxn({ txn, pair: pair ?? undefined })
  }

  if (source === null) {
    return (
      <div className="card">
        <EmptyState
          icon={<Landmark size={40} />}
          title="Account not found"
          subtitle="It may have been deleted."
          action={<button className="btn btn-primary" onClick={() => navigate('/budget/accounts')}>Back to accounts</button>}
        />
      </div>
    )
  }

  if (source === undefined) return <div className="empty">Loading…</div>

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <>
      <PageHeader
        title={source.name}
        subtitle="Account activity"
        onBack={() => navigate('/budget/accounts')}
        actions={
          <>
            <button className="icon-btn" aria-label="Edit account" onClick={() => setShowEdit(true)}>
              <Pencil size={18} />
            </button>
            <button className="icon-btn" aria-label="Manage accounts and categories" onClick={() => setShowManage(true)}>
              <Settings2 size={18} />
            </button>
            <button className="icon-btn" aria-label="Delete account" onClick={() => setDeletingAccount(true)}>
              <Trash2 size={18} color="var(--error)" />
            </button>
          </>
        }
      />

      <div className="hero" style={{ marginBottom: 16 }}>
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="hero-label">Current balance</div>
            <div className="big-amount">{formatMoney(source.balance)}</div>
          </div>
          <MonthYearPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
        </div>
        <div className="hero-row">
          <div>
            <div className="hero-label">Credits</div>
            <div className="bold" style={{ color: 'var(--success)' }}>{formatMoney(totalIncome)}</div>
          </div>
          <div>
            <div className="hero-label">Spends</div>
            <div className="bold" style={{ color: 'var(--error)' }}>{formatMoney(totalExpenses)}</div>
          </div>
          <div>
            <div className="hero-label">Net</div>
            <div className="bold">{formatMoney(totalIncome - totalExpenses)}</div>
          </div>
        </div>
      </div>

      {(categories ?? []).length > 0 && (
        <div className="chip-row" style={{ marginBottom: 14 }}>
          {[...categoryFilter].map((cat) => (
            <button
              key={cat}
              className="chip active"
              onClick={() => setCategoryFilter((prev) => {
                const next = new Set(prev)
                next.delete(cat)
                return next
              })}
            >
              {cat} <X size={12} />
            </button>
          ))}
          {(categories ?? []).map((c) => (
            <button
              key={c.id}
              className={`chip ${categoryFilter.has(c.name) ? 'active' : ''}`}
              onClick={() => setCategoryFilter((prev) => {
                const next = new Set(prev)
                if (next.has(c.name)) next.delete(c.name)
                else next.add(c.name)
                return next
              })}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <Section
        title={`Credits · ${monthLabel}`}
        total={totalIncome}
        tone="positive"
        open={creditsOpen}
        onToggle={() => setCreditsOpen((v) => !v)}
        onAdd={() => setAddType('Income')}
      >
        {income.length === 0 ? (
          <p className="small muted">No credits recorded.</p>
        ) : (
          <TxnRows rows={income} onEdit={openEdit} onDelete={setDeletingTxn} />
        )}
      </Section>

      <Section
        title={`Spending · ${monthLabel}`}
        total={totalExpenses}
        tone="negative"
        open={spendsOpen}
        onToggle={() => setSpendsOpen((v) => !v)}
        onAdd={() => setAddType('Expense')}
      >
        {expenses.length === 0 ? (
          <p className="small muted">No spending recorded.</p>
        ) : (
          <TxnRows rows={expenses} onEdit={openEdit} onDelete={setDeletingTxn} />
        )}
      </Section>

      <button className="fab" aria-label="Add transaction" onClick={() => setAddType('Expense')}>
        <Plus size={26} />
      </button>

      {addType && (
        <TransactionDialog type={addType} source={source.name} onClose={() => setAddType(null)} />
      )}
      {editingTxn && (
        <TransactionDialog
          transaction={editingTxn.txn}
          transferFrom={editingTxn.pair?.from}
          transferTo={editingTxn.pair?.to}
          onClose={() => setEditingTxn(null)}
        />
      )}
      {showManage && (
        <ManageSourcesCategoriesDialog
          sources={sources ?? []}
          categories={categories ?? []}
          onClose={() => setShowManage(false)}
        />
      )}
      {showEdit && <EditAccountDialog source={source} onClose={() => setShowEdit(false)} />}

      <ConfirmDialog
        open={deletingTxn != null}
        title={deletingTxn?.type === 'Income' ? 'Delete Credit' : 'Delete Spend'}
        message="Delete this transaction? The account balance will be adjusted back."
        onCancel={() => setDeletingTxn(null)}
        onConfirm={async () => {
          if (deletingTxn) await deleteTransactionCascade(deletingTxn)
          setDeletingTxn(null)
        }}
      />
      <ConfirmDialog
        open={deletingAccount}
        title="Delete Account"
        message={`Delete "${source.name}"? Its transactions stay in the ledger with the same label.`}
        onCancel={() => setDeletingAccount(false)}
        onConfirm={async () => {
          await deleteSource(source.id!)
          navigate('/budget/accounts')
        }}
      />
    </>
  )
}

function Section({
  title,
  total,
  tone,
  open,
  onToggle,
  onAdd,
  children,
}: {
  title: string
  total: number
  tone: 'positive' | 'negative'
  open: boolean
  onToggle: () => void
  onAdd: () => void
  children: React.ReactNode
}) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row-between">
        <button className="row grow" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={onToggle} aria-expanded={open}>
          <span className="grow" style={{ textAlign: 'left' }}>
            <span className="section-label">{title}</span>
            <div className="stat-value" style={{ fontSize: 20, color: tone === 'positive' ? 'var(--success)' : 'var(--error)' }}>
              {formatMoney(total)}
            </div>
          </span>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        <button className="icon-btn" aria-label={`Add ${tone === 'positive' ? 'credit' : 'spend'}`} onClick={onAdd}>
          <Plus size={20} />
        </button>
      </div>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  )
}

function TxnRows({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Transaction[]
  onEdit: (txn: Transaction) => void
  onDelete: (txn: Transaction) => void
}) {
  return (
    <div className="list">
      {rows
        .slice()
        .sort((a, b) => b.date - a.date)
        .map((t) => (
          <div key={t.id} className="list-row tight">
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="truncate">{t.description || t.category}</div>
              <div className="tiny muted">
                {t.category} · {formatDate(t.date)}
              </div>
            </div>
            <Money value={t.type === 'Income' ? t.amount : -t.amount} />
            {t.linkedCardTxnId == null && (
              <button
                className="icon-btn"
                style={{ width: 30, height: 30 }}
                aria-label="Edit transaction"
                onClick={() => onEdit(t)}
              >
                <Pencil size={14} />
              </button>
            )}
            <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label="Delete transaction" onClick={() => onDelete(t)}>
              <X size={15} color="var(--error)" />
            </button>
          </div>
        ))}
    </div>
  )
}

function EditAccountDialog({ source, onClose }: { source: Source; onClose: () => void }) {
  const [name, setName] = useState(source.name)
  const [balance, setBalance] = useState(String(source.balance))
  const [error, setError] = useState('')

  const save = async () => {
    const value = name.trim()
    if (!value) return
    const existing = await db.sources.toArray()
    if (existing.some((s) => s.id !== source.id && s.name.trim().toLowerCase() === value.toLowerCase())) {
      setError('An account with that name already exists')
      return
    }
    await db.transaction('rw', db.sources, db.transactions, async () => {
      await db.sources.update(source.id!, { name: value, balance: Number(balance) || 0 })
      if (value !== source.name) {
        await db.transactions.where('source').equals(source.name).modify({ source: value })
      }
    })
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit Account"
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!name.trim()}>Save</button>
        </div>
      }
    >
      <div className="stack">
        <Field label="Account name *">
          <TextInput autoFocus value={name} onChange={(e) => { setName(e.target.value); setError('') }} />
        </Field>
        <Field label="Current balance" hint="Use this to reconcile the account with your bank.">
          <MoneyInput value={balance} onChange={setBalance} label="Current balance" />
        </Field>
        {error && <p className="tiny" style={{ color: 'var(--error)' }}>{error}</p>}
      </div>
    </Dialog>
  )
}
