import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Pencil, Plus, Trash2, TrendingUp } from 'lucide-react'
import { db } from '../../db/db'
import { INVESTMENT_TYPES, type Investment } from '../../db/types'
import { formatDate, toDateKey } from '../../lib/dates'
import { formatMoney, formatPercent } from '../../lib/format'
import MarkdownPreview from '../../components/MarkdownPreview'
import { RichTextEditor } from '../../components/RichTextEditor'
import {
  ConfirmDialog,
  DateField,
  Dialog,
  EmptyState,
  ListSkeleton,
  Field,
  FieldGroup,
  MoneyInput,
  PageHeader,
  Segmented,
  TextInput,
} from '../../components/ui'
import { MonthYearPicker } from './shared'

export default function InvestmentsScreen() {
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [scope, setScope] = useState<'month' | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Investment | null>(null)
  const [deleting, setDeleting] = useState<Investment | null>(null)

  const investments = useLiveQuery(async () => db.investments.toArray(), [])

  const totalInvested = (investments ?? []).reduce((s, i) => s + i.units * i.purchasePrice, 0)
  const totalCurrent = (investments ?? []).reduce((s, i) => s + i.units * i.currentPrice, 0)
  const profitLoss = totalCurrent - totalInvested
  const profitPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0

  const allocation = useMemo(() => {
    const map = new Map<string, number>()
    for (const inv of investments ?? []) {
      map.set(inv.type || 'Other', (map.get(inv.type || 'Other') ?? 0) + inv.units * inv.currentPrice)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [investments])

  const filtered = useMemo(() => {
    if (scope === 'all') return investments ?? []
    return (investments ?? []).filter((i) => {
      const d = new Date(i.purchaseDate)
      return d.getFullYear() === year && d.getMonth() + 1 === month
    })
  }, [investments, scope, year, month])

  const maxAllocation = Math.max(...allocation.map(([, v]) => v), 1)
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  if (investments === undefined) return <ListSkeleton rows={4} />

  return (
    <>
      <PageHeader
        title="Investments"
        subtitle="Portfolio value, allocation and profit/loss"
        onBack={() => navigate('/budget')}
        actions={
          <button className="btn btn-sm btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Investment
          </button>
        }
      />

      <div className="hero" style={{ marginBottom: 16 }}>
        <div className="hero-label">Portfolio value</div>
        <div className="big-amount">{formatMoney(totalCurrent)}</div>
        <div className="hero-row">
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
          <div>
            <div className="hero-label">Return</div>
            <div className="bold" style={{ color: profitLoss >= 0 ? 'var(--success)' : 'var(--error)' }}>
              {profitPercent >= 0 ? '+' : ''}{formatPercent(profitPercent, 2)}
            </div>
          </div>
        </div>
      </div>

      {allocation.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="bold" style={{ marginBottom: 12 }}>Allocation by type</div>
          <div className="stack" style={{ gap: 10 }}>
            {allocation.map(([type, value]) => (
              <div key={type} className="bar-row">
                <span className="small truncate" style={{ width: 92, flex: '0 0 92px' }}>{type}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(value / maxAllocation) * 100}%`, background: 'var(--secondary)' }} />
                </div>
                <span className="tiny bold" style={{ width: 78, textAlign: 'right', flex: '0 0 78px' }}>{formatMoney(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="row-between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <Segmented
          value={scope}
          onChange={setScope}
          label="Investment period"
          options={[
            { value: 'month', label: 'This month' },
            { value: 'all', label: 'All' },
          ]}
        />
        {scope === 'month' && <MonthYearPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />}
        {scope === 'all' && <span className="small muted">{(investments ?? []).length} holdings</span>}
      </div>

      {scope === 'month' && <p className="small muted" style={{ marginBottom: 10 }}>Purchases in {monthLabel}</p>}

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<TrendingUp size={40} />}
            title={scope === 'month' ? 'No investments this month' : 'No investments yet'}
            subtitle="Add a holding to track its value and return."
            action={
              <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> Add investment
              </button>
            }
          />
        </div>
      ) : (
        <div className="stack">
          {filtered
            .slice()
            .sort((a, b) => b.purchaseDate - a.purchaseDate)
            .map((inv) => {
              const invested = inv.units * inv.purchasePrice
              const current = inv.units * inv.currentPrice
              const profit = current - invested
              const pct = invested > 0 ? (profit / invested) * 100 : 0
              return (
                <div key={inv.id} className="card">
                  <div className="row-between">
                    <div className="row grow" style={{ minWidth: 0 }}>
                      <div className="avatar primary">
                        <TrendingUp size={19} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="bold truncate">{inv.name}</div>
                        <div className="tiny muted">
                          {inv.type} · {inv.units} units · {formatDate(inv.purchaseDate)}
                        </div>
                      </div>
                    </div>
                    <div className="icon-actions">
                      <button className="icon-btn" aria-label="Edit investment" onClick={() => setEditing(inv)}>
                        <Pencil size={17} />
                      </button>
                      <button className="icon-btn" aria-label="Delete investment" onClick={() => setDeleting(inv)}>
                        <Trash2 size={17} color="var(--error)" />
                      </button>
                    </div>
                  </div>

                  <div className="hero-row" style={{ marginTop: 14 }}>
                    <div>
                      <div className="hero-label">Invested</div>
                      <div className="bold">{formatMoney(invested)}</div>
                    </div>
                    <div>
                      <div className="hero-label">Current</div>
                      <div className="bold">{formatMoney(current)}</div>
                    </div>
                    <div>
                      <div className="hero-label">P&amp;L</div>
                      <div className="bold" style={{ color: profit >= 0 ? 'var(--success)' : 'var(--error)' }}>
                        {formatMoney(profit)} ({pct >= 0 ? '+' : ''}{formatPercent(pct, 2)})
                      </div>
                    </div>
                  </div>

                  {inv.notes && (
                    <div className="small muted" style={{ marginTop: 8 }}>
                      <MarkdownPreview content={inv.notes} />
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}

      <button className="fab" aria-label="Add investment" onClick={() => setShowAdd(true)}>
        <Plus size={26} />
      </button>

      {showAdd && <InvestmentDialog onClose={() => setShowAdd(false)} />}
      {editing && <InvestmentDialog investment={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={deleting != null}
        title="Delete Investment"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting?.id != null) await db.investments.delete(deleting.id)
          setDeleting(null)
        }}
      />
    </>
  )
}

function InvestmentDialog({ investment, onClose }: { investment?: Investment; onClose: () => void }) {
  const [name, setName] = useState(investment?.name ?? '')
  const [type, setType] = useState(investment?.type ?? '')
  const [units, setUnits] = useState(investment?.units != null ? String(investment.units) : '')
  const [purchasePrice, setPurchasePrice] = useState(investment?.purchasePrice != null ? String(investment.purchasePrice) : '')
  const [currentPrice, setCurrentPrice] = useState(investment?.currentPrice != null ? String(investment.currentPrice) : '')
  const [purchaseDate, setPurchaseDate] = useState(
    investment ? toDateKey(investment.purchaseDate) : toDateKey(new Date()),
  )
  const [notes, setNotes] = useState(investment?.notes ?? '')

  const u = Number(units)
  const pp = Number(purchasePrice)
  const cp = Number(currentPrice)
  const valid = name.trim() !== '' && type !== '' && u > 0 && pp > 0 && cp > 0

  const save = async () => {
    if (!valid) return
    const payload = {
      name: name.trim(),
      type,
      units: u,
      purchasePrice: pp,
      currentPrice: cp,
      purchaseDate: new Date(`${purchaseDate}T12:00:00`).getTime(),
      notes: notes.trim(),
    }
    if (investment?.id != null) await db.investments.update(investment.id, payload)
    else await db.investments.add({ ...payload, createdAt: Date.now() })
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={investment ? 'Edit Investment' : 'Add Investment'}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!valid}>{investment ? 'Save' : 'Add'}</button>
        </div>
      }
    >
      <div className="stack">
        <Field label="Name *">
          <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nifty 50 Index Fund" />
        </Field>
        <FieldGroup label="Type *">
          <div className="chip-row">
            {INVESTMENT_TYPES.map((t) => (
              <button key={t} className={`chip ${type === t ? 'active' : ''}`} onClick={() => setType(t)}>
                {t}
              </button>
            ))}
          </div>
        </FieldGroup>
        <div className="grid-2">
          <Field label="Units *">
            <TextInput type="number" inputMode="decimal" step="any" value={units} onChange={(e) => setUnits(e.target.value)} />
          </Field>
          <Field label="Purchase date">
            <DateField value={purchaseDate} onChange={setPurchaseDate} ariaLabel="Purchase date" />
          </Field>
          <Field label="Purchase price / unit *">
            <MoneyInput value={purchasePrice} onChange={setPurchasePrice} label="Purchase price" />
          </Field>
          <Field label="Current price / unit *">
            <MoneyInput value={currentPrice} onChange={setCurrentPrice} label="Current price" />
          </Field>
        </div>
        <Field label="Notes">
          <RichTextEditor
            value={notes}
            onValueChange={setNotes}
            placeholder="Optional"
            size="sm"
            ariaLabel="Investment notes"
          />
        </Field>
      </div>
    </Dialog>
  )
}
