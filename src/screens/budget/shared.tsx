import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search, Trash2 } from 'lucide-react'
import { db } from '../../db/db'
import type { Category, Source, TransactionType } from '../../db/types'
import { MONTHS, MONTHS_SHORT } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import {
  Dialog,
  Field,
  IconButton,
  TextInput,
} from '../../components/ui'
import {
  addExpense,
  addIncome,
  categoryNameExists,
  deleteCategory,
  deleteSource,
  renameCategory,
  renameSource,
  sourceNameExists,
} from '../../db/budget'

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

type ItemKind = 'source' | 'category'

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

  const items = useMemo(() => {
    const list =
      tab === 'source'
        ? sources.map((s) => ({ id: s.id!, name: s.name, meta: formatMoney(s.balance) }))
        : categories.map((c) => ({ id: c.id!, name: c.name, meta: c.isDefault ? 'Default' : '' }))
    const q = search.trim().toLowerCase()
    return list.filter((item) => !q || item.name.toLowerCase().includes(q))
  }, [tab, sources, categories, search])

  const add = async () => {
    const value = name.trim()
    if (!value) return
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
    } else {
      if (await categoryNameExists(value, editing.id)) {
        setError('A category with that name already exists')
        return
      }
      await renameCategory(editing.id, value)
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
        </div>

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
        {error && <p className="tiny" style={{ color: 'var(--error)', marginTop: 6 }}>{error}</p>}

        <div className="search" style={{ marginTop: 12 }}>
          <Search size={16} />
          <input className="input" placeholder={`Search ${tab === 'source' ? 'accounts' : 'categories'}`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div style={{ marginTop: 8, maxHeight: 300, overflowY: 'auto' }}>
          {items.length === 0 ? (
            <p className="small muted" style={{ padding: '12px 0' }}>
              No {tab === 'source' ? 'accounts' : 'categories'} yet.
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
          Renaming updates every existing transaction so totals stay consistent.
        </p>
      </Dialog>

      <Dialog
        open={deleting != null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.kind === 'source' ? 'Account' : 'Category'}`}
        footer={
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setDeleting(null)}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                if (!deleting) return
                if (deleting.kind === 'source') await deleteSource(deleting.id)
                else await deleteCategory(deleting.id)
                setDeleting(null)
              }}
            >
              Delete
            </button>
          </div>
        }
      >
        <p className="muted">
          Delete &quot;{deleting?.name}&quot;? Existing transactions keep their label and stay in the totals.
        </p>
      </Dialog>
    </>
  )
}

export function TransactionDialog({
  type: initialType,
  source,
  onClose,
}: {
  type: TransactionType
  source?: string
  onClose: () => void
}) {
  const [type, setType] = useState<TransactionType>(initialType)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [sourceName, setSourceName] = useState(source ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')

  const sources = useLiveQuery(async () => db.sources.toArray(), [], [])
  const categories = useLiveQuery(async () => db.categories.toArray(), [], [])
  const sourceList = sources ?? []
  const categoryList = categories ?? []

  const amountValue = Number(amount)
  const valid =
    amount.trim() !== '' &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    (type === 'Income' || category !== '') &&
    sourceName !== ''

  const save = async () => {
    if (!valid) return
    const when = new Date(`${date}T12:00:00`).getTime()
    try {
      if (type === 'Income') {
        await addIncome({ amount: amountValue, source: sourceName, category: category || 'Income', description, date: when })
      } else {
        await addExpense({ amount: amountValue, source: sourceName, category, description, date: when })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={type === 'Income' ? 'Add Credit' : 'Add Spend'}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!valid}>Add</button>
        </div>
      }
    >
      <div className="stack">
        <div className="chip-row wrap">
          {(['Expense', 'Income'] as TransactionType[]).map((t) => (
            <button key={t} className={`chip ${type === t ? 'active' : ''}`} onClick={() => setType(t)}>
              {t === 'Expense' ? 'Spend' : 'Credit'}
            </button>
          ))}
        </div>

        <Field label="Amount *">
          <TextInput type="number" inputMode="decimal" min={0} step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Description">
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        {type === 'Expense' && (
          <Field label="Category *">
            <div className="chip-row wrap">
              {(categoryList ?? []).map((c) => (
                <button key={c.id} className={`chip ${category === c.name ? 'active' : ''}`} onClick={() => setCategory(c.name)}>
                  {c.name}
                </button>
              ))}
            </div>
            {categoryList && categoryList.length === 0 && (
              <span className="tiny muted">Add a category from Accounts → Manage first.</span>
            )}
          </Field>
        )}

        <Field label="Account *">
          <div className="chip-row wrap">
            {(sourceList ?? []).map((s) => (
              <button key={s.id} className={`chip ${sourceName === s.name ? 'active' : ''}`} onClick={() => setSourceName(s.name)}>
                {s.name}
              </button>
            ))}
          </div>
          {sourceList && sourceList.length === 0 && (
            <span className="tiny muted">Add an account from Accounts → Manage first.</span>
          )}
        </Field>
        {error && <p className="tiny" style={{ color: 'var(--error)' }}>{error}</p>}
      </div>
    </Dialog>
  )
}
