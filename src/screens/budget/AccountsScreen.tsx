import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronUp,
  Landmark,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react'
import { db } from '../../db/db'
import type { Source, Transaction } from '../../db/types'
import { deleteSource } from '../../db/budget'
import { formatDate } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { ConfirmDialog, Dialog, EmptyState, Field, PageHeader, TextInput } from '../../components/ui'
import { ManageSourcesCategoriesDialog, Money, MultiMonthYearFilter } from './shared'

export default function AccountsScreen() {
  const navigate = useNavigate()
  const now = new Date()
  const [months, setMonths] = useState<Set<number>>(new Set([now.getMonth() + 1]))
  const [years, setYears] = useState<Set<number>>(new Set([now.getFullYear()]))
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [showManage, setShowManage] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [deleting, setDeleting] = useState<Source | null>(null)

  const sources = useLiveQuery(async () => db.sources.toArray(), [], [])
  const transactions = useLiveQuery(async () => db.transactions.toArray(), [], [])
  const categories = useLiveQuery(async () => db.categories.toArray(), [], [])

  const allYears = useMemo(() => {
    const set = new Set<number>([now.getFullYear()])
    for (const t of transactions ?? []) set.add(new Date(t.date).getFullYear())
    return [...set].sort((a, b) => b - a)
  }, [transactions, now])

  const filtered = useMemo(
    () =>
      (transactions ?? []).filter((t) => {
        const d = new Date(t.date)
        return months.has(d.getMonth() + 1) && years.has(d.getFullYear())
      }),
    [transactions, months, years],
  )

  const periodLabel =
    months.size === 12 ? 'All months' : months.size === 1 ? new Date(2020, [...months][0] - 1, 1).toLocaleDateString('en-US', { month: 'short' }) : `${months.size} months`
  const yearLabel = years.size === 1 ? `${[...years][0]}` : `${years.size} years`

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Bank accounts, balances and activity"
        onBack={() => navigate('/budget')}
        actions={
          <>
            <button className="btn btn-sm btn-outline" onClick={() => setShowManage(true)}>
              <Settings2 size={16} /> Manage
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Account
            </button>
          </>
        }
      />

      {(sources ?? []).length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Landmark size={40} />}
            title="No accounts yet"
            subtitle="Add your bank accounts to track balances, credits and spends."
            action={
              <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> Add account
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row-between" style={{ marginBottom: 10 }}>
              <span className="section-label">Period</span>
              <span className="small muted">
                {periodLabel} · {yearLabel}
              </span>
            </div>
            <MultiMonthYearFilter
              months={months}
              years={years}
              onMonths={setMonths}
              onYears={setYears}
              allYears={allYears}
            />
          </div>

          <div className="stack">
            {(sources ?? []).map((source) => {
              const rows = filtered.filter((t) => t.source === source.name)
              const credits = rows.filter((t) => t.type === 'Income').reduce((s, t) => s + t.amount, 0)
              const spends = rows.filter((t) => t.type === 'Expense').reduce((s, t) => s + t.amount, 0)
              const isOpen = expanded.has(source.id!)
              return (
                <div key={source.id} className="card flush">
                  <div
                    className="account-row"
                    style={{ alignItems: 'flex-start' }}
                    onClick={() => setExpanded((prev) => {
                      const next = new Set(prev)
                      if (next.has(source.id!)) next.delete(source.id!)
                      else next.add(source.id!)
                      return next
                    })}
                  >
                    <div className="avatar primary">
                      <Landmark size={19} />
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row-between">
                        <div className="bold truncate">{source.name}</div>
                        <div className="icon-actions">
                          <button
                            className="icon-btn"
                            aria-label={`Delete ${source.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleting(source)
                            }}
                          >
                            <Trash2 size={16} color="var(--error)" />
                          </button>
                          {isOpen ? <ChevronUp size={18} className="muted" /> : <ChevronDown size={18} className="muted" />}
                        </div>
                      </div>
                      <div className="small muted">Balance {formatMoney(source.balance)}</div>
                      <div className="row-between" style={{ marginTop: 6 }}>
                        <div className="mini-stats">
                          <div className="mini-stat">
                            <div className="tiny muted">Credits</div>
                            <div className="small money-positive">{formatMoney(credits)}</div>
                          </div>
                          <div className="mini-stat">
                            <div className="tiny muted">Spends</div>
                            <div className="small money-negative">{formatMoney(spends)}</div>
                          </div>
                        </div>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/budget/accounts/${source.id}`)
                          }}
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ padding: '0 16px 12px' }}>
                      <hr className="hr" />
                      {rows.length === 0 ? (
                        <p className="small muted">No transactions in the selected period.</p>
                      ) : (
                        <TransactionList rows={rows} />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <button className="fab" aria-label="Add account" onClick={() => setShowAdd(true)}>
        <Plus size={26} />
      </button>

      {showAdd && <AddAccountDialog onClose={() => setShowAdd(false)} />}
      {showManage && (
        <ManageSourcesCategoriesDialog
          sources={sources ?? []}
          categories={categories ?? []}
          onClose={() => setShowManage(false)}
        />
      )}

      <ConfirmDialog
        open={deleting != null}
        title="Delete Account"
        message={`Delete "${deleting?.name}"? Its transactions stay in the ledger with the same label.`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting?.id != null) await deleteSource(deleting.id)
          setDeleting(null)
        }}
      />
    </>
  )
}

function TransactionList({ rows }: { rows: Transaction[] }) {
  return (
    <div className="list">
      {rows
        .slice()
        .sort((a, b) => b.date - a.date)
        .map((t) => (
          <div key={t.id} className="list-row tight">
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="small truncate">{t.description || t.category}</div>
              <div className="tiny muted">
                {t.category} · {formatDate(t.date)}
              </div>
            </div>
            <Money value={t.type === 'Income' ? t.amount : -t.amount} />
          </div>
        ))}
    </div>
  )
}

function AddAccountDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')
  const [error, setError] = useState('')

  const save = async () => {
    const value = name.trim()
    if (!value) return
    const existing = await db.sources.toArray()
    if (existing.some((s) => s.name.trim().toLowerCase() === value.toLowerCase())) {
      setError('An account with that name already exists')
      return
    }
    await db.sources.add({
      name: value,
      balance: Number(balance) || 0,
      isDefault: false,
      createdAt: Date.now(),
    })
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add Account"
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!name.trim()}>Add</button>
        </div>
      }
    >
      <div className="stack">
        <Field label="Account name *">
          <TextInput autoFocus value={name} onChange={(e) => { setName(e.target.value); setError('') }} placeholder="e.g. HDFC Savings" />
        </Field>
        <Field label="Opening balance" hint="Used as the current balance until you add transactions.">
          <TextInput type="number" inputMode="decimal" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" />
        </Field>
        {error && <p className="tiny" style={{ color: 'var(--error)' }}>{error}</p>}
      </div>
    </Dialog>
  )
}
