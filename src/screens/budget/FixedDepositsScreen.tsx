import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react'
import { db } from '../../db/db'
import type { FdCompounding, FdMode, FixedDeposit } from '../../db/types'
import {
  FD_COMPOUNDINGS,
  FD_COMPOUNDING_LABELS,
  FD_MODES,
  addFixedDeposit,
  deleteFixedDeposit,
  fdAccruedInterest,
  fdCurrentValue,
  fdDaysToMaturity,
  fdEffectiveYield,
  fdMaturityAmount,
  fdMaturityDate,
  fdProgress,
  fdStatus,
  fdTotalInterest,
  summarizeFixedDeposits,
  updateFixedDeposit,
} from '../../db/fixedDeposits'
import { formatDate, toDateKey } from '../../lib/dates'
import { formatMoney, formatPercent } from '../../lib/format'
import MarkdownPreview from '../../components/MarkdownPreview'
import { RichTextEditor } from '../../components/RichTextEditor'
import {
  ConfirmDialog,
  DateField,
  Dialog,
  EmptyState,
  Field,
  FieldGroup,
  ListSkeleton,
  MoneyInput,
  PageHeader,
  ProgressBar,
  Segmented,
  Select,
  TextInput,
} from '../../components/ui'

type Filter = 'Active' | 'Matured' | 'All'

export default function FixedDepositsScreen() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('Active')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<FixedDeposit | null>(null)
  const [deleting, setDeleting] = useState<FixedDeposit | null>(null)

  const deposits = useLiveQuery(async () => db.fixedDeposits.toArray(), [])
  const sources = useLiveQuery(async () => db.sources.toArray(), [], [])

  const now = new Date()
  const summary = summarizeFixedDeposits(deposits ?? [], now.getTime())
  const visible = useMemo(() => {
    const list = (deposits ?? []).filter((fd) => {
      const status = fdStatus(fd, now.getTime())
      return filter === 'All' || status === filter
    })
    return list.sort((a, b) => {
      const aActive = fdStatus(a, now.getTime()) === 'Active'
      const bActive = fdStatus(b, now.getTime()) === 'Active'
      if (aActive !== bActive) return aActive ? -1 : 1
      return aActive
        ? fdMaturityDate(a) - fdMaturityDate(b)
        : fdMaturityDate(b) - fdMaturityDate(a)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deposits, filter])

  const nextMaturity = useMemo(
    () =>
      (deposits ?? [])
        .filter((fd) => fdStatus(fd, now.getTime()) === 'Active')
        .sort((a, b) => fdMaturityDate(a) - fdMaturityDate(b))[0],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deposits],
  )

  if (deposits === undefined || sources === undefined) return <ListSkeleton rows={4} />

  return (
    <>
      <PageHeader
        title="Fixed Deposits"
        subtitle="Principal, interest and maturity"
        onBack={() => navigate('/budget')}
        actions={
          <button className="btn btn-sm btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> FD
          </button>
        }
      />

      <div className="hero" style={{ marginBottom: 16 }}>
        <div className="hero-label">Fixed deposit value</div>
        <div className="big-amount">{formatMoney(summary.currentValue)}</div>
        <div className="hero-row">
          <div>
            <div className="hero-label">Principal</div>
            <div className="bold">{formatMoney(summary.principal)}</div>
          </div>
          <div>
            <div className="hero-label">Interest accrued</div>
            <div className="bold" style={{ color: 'var(--success)' }}>
              {formatMoney(summary.accruedInterest)}
            </div>
          </div>
          <div>
            <div className="hero-label">At maturity</div>
            <div className="bold">{formatMoney(summary.maturityValue)}</div>
          </div>
        </div>
        <div className="tiny muted" style={{ marginTop: 10 }}>
          {summary.active} active · {summary.matured} matured
          {nextMaturity
            ? ` · next maturity ${formatDate(fdMaturityDate(nextMaturity))}`
            : ''}
        </div>
      </div>

      <div className="row-between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          label="Fixed deposit filter"
          options={[
            { value: 'Active', label: `Active (${summary.active})` },
            { value: 'Matured', label: `Matured (${summary.matured})` },
            { value: 'All', label: 'All' },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<PiggyBank size={40} />}
            title={filter === 'Matured' ? 'No matured FDs' : 'No fixed deposits yet'}
            subtitle="Add an FD to track principal, interest and maturity."
            action={
              <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> Add fixed deposit
              </button>
            }
          />
        </div>
      ) : (
        <div className="stack">
          {visible.map((fd) => {
            const status = fdStatus(fd, now.getTime())
            const days = fdDaysToMaturity(fd, now.getTime())
            const interest = fdAccruedInterest(fd, now.getTime())
            return (
              <div key={fd.id} className="card">
                <div className="row-between">
                  <div className="row grow" style={{ minWidth: 0 }}>
                    <div className="avatar primary">
                      <PiggyBank size={19} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="bold truncate">{fd.name}</div>
                      <div className="tiny muted">
                        {fd.annualRate}% p.a. ·{' '}
                        {fd.mode === 'Cumulative'
                          ? `${fd.compounding} compounding`
                          : 'Interest paid out'}
                        {fd.source ? ` · ${fd.source}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="icon-actions">
                    <button
                      className="icon-btn"
                      aria-label="Edit fixed deposit"
                      onClick={() => setEditing(fd)}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="Delete fixed deposit"
                      onClick={() => setDeleting(fd)}
                    >
                      <Trash2 size={17} color="var(--error)" />
                    </button>
                  </div>
                </div>

                <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                  <span className={`badge ${status === 'Matured' ? 'medium' : 'primary'}`}>
                    {status === 'Matured' ? 'Matured' : `Matures in ${Math.max(0, days)} days`}
                  </span>
                  <span className="badge">{fd.tenureMonths} months</span>
                  {fd.source && <span className="badge">Debited from {fd.source}</span>}
                </div>

                <div className="hero-row" style={{ marginTop: 12 }}>
                  <div>
                    <div className="hero-label">Principal</div>
                    <div className="bold">{formatMoney(fd.principal)}</div>
                  </div>
                  <div>
                    <div className="hero-label">
                      {fd.mode === 'Payout' ? 'Interest earned' : 'Accrued interest'}
                    </div>
                    <div className="bold" style={{ color: 'var(--success)' }}>
                      {formatMoney(interest)}
                    </div>
                  </div>
                  <div>
                    <div className="hero-label">
                      {fd.mode === 'Payout' ? 'Principal value' : 'Current value'}
                    </div>
                    <div className="bold">{formatMoney(fdCurrentValue(fd, now.getTime()))}</div>
                  </div>
                </div>

                <div className="tiny muted" style={{ marginTop: 8 }}>
                  {formatDate(fd.startDate)} → {formatDate(fdMaturityDate(fd))} · maturity{' '}
                  {formatMoney(fdMaturityAmount(fd))}
                  {fd.maturityAmountOverride != null ? ' (bank-stated)' : ''}
                </div>

                <div style={{ marginTop: 8 }}>
                  <ProgressBar
                    value={fdProgress(fd, now.getTime())}
                    color={status === 'Matured' ? 'var(--success)' : undefined}
                  />
                </div>

                {fd.notes.trim() !== '' && (
                  <div className="small muted" style={{ marginTop: 8 }}>
                    <MarkdownPreview content={fd.notes} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <button className="fab" aria-label="Add fixed deposit" onClick={() => setShowAdd(true)}>
        <Plus size={26} />
      </button>

      {showAdd && (
        <FixedDepositDialog sources={sources ?? []} onClose={() => setShowAdd(false)} />
      )}
      {editing && (
        <FixedDepositDialog
          fd={editing}
          sources={sources ?? []}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={deleting != null}
        title="Delete Fixed Deposit"
        message={
          deleting?.source
            ? `Delete "${deleting?.name}"? The linked bank debit from ${deleting.source} will also be removed and that account's balance restored.`
            : `Delete "${deleting?.name}"?`
        }
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await deleteFixedDeposit(deleting)
          setDeleting(null)
        }}
      />
    </>
  )
}

function FixedDepositDialog({
  fd,
  sources,
  onClose,
}: {
  fd?: FixedDeposit
  sources: { name: string }[]
  onClose: () => void
}) {
  const editing = fd != null
  const [name, setName] = useState(fd?.name ?? '')
  const [principal, setPrincipal] = useState(fd ? String(fd.principal) : '')
  const [rate, setRate] = useState(fd ? String(fd.annualRate) : '')
  const [startDate, setStartDate] = useState(
    fd ? toDateKey(fd.startDate) : toDateKey(new Date()),
  )
  const [tenure, setTenure] = useState(fd ? String(fd.tenureMonths) : '12')
  const [mode, setMode] = useState<FdMode>(fd?.mode ?? 'Cumulative')
  const [compounding, setCompounding] = useState<FdCompounding>(
    fd?.compounding ?? 'Quarterly',
  )
  const [override, setOverride] = useState(
    fd?.maturityAmountOverride != null ? String(fd.maturityAmountOverride) : '',
  )
  const [source, setSource] = useState(fd?.source ?? '')
  const [notes, setNotes] = useState(fd?.notes ?? '')

  const principalValue = Number(principal)
  const rateValue = Number(rate)
  const tenureValue = Number(tenure)
  const overrideRaw = override.trim() !== '' ? Number(override) : null
  const overrideValue =
    overrideRaw != null && Number.isFinite(overrideRaw) && overrideRaw > 0
      ? overrideRaw
      : null
  const sourceNames = sources.map((item) => item.name)
  if (source && !sourceNames.includes(source)) sourceNames.push(source)

  const valid =
    name.trim() !== '' &&
    Number.isFinite(principalValue) &&
    principalValue > 0 &&
    Number.isFinite(rateValue) &&
    rateValue >= 0 &&
    Number.isFinite(tenureValue) &&
    tenureValue > 0 &&
    (override.trim() === '' || overrideValue != null)

  const start = startDate ? new Date(`${startDate}T12:00:00`) : new Date()
  const preview: FixedDeposit = {
    name: name.trim() || 'Fixed Deposit',
    principal: Number.isFinite(principalValue) ? Math.max(0, principalValue) : 0,
    annualRate: Number.isFinite(rateValue) ? Math.max(0, rateValue) : 0,
    startDate: start.getTime(),
    tenureMonths: Math.max(1, Math.round(Number.isFinite(tenureValue) ? tenureValue : 12)),
    mode,
    compounding: mode === 'Payout' ? 'Simple' : compounding,
    maturityAmountOverride: overrideValue,
    source,
    fundingKey: fd?.fundingKey ?? null,
    notes,
    createdAt: fd?.createdAt ?? Date.now(),
  }
  const maturityDate = fdMaturityDate(preview)
  const maturityValue = fdMaturityAmount(preview)
  const totalInterest = fdTotalInterest(preview)
  const effectiveYield = fdEffectiveYield(preview)

  const save = async () => {
    if (!valid) return
    const input = {
      name: name.trim(),
      principal: principalValue,
      annualRate: rateValue,
      startDate: start.getTime(),
      tenureMonths: Math.max(1, Math.round(tenureValue)),
      mode,
      compounding: mode === 'Payout' ? ('Simple' as FdCompounding) : compounding,
      maturityAmountOverride: overrideValue,
      source,
      notes: notes.trim(),
    }
    if (fd?.id != null) await updateFixedDeposit(fd, input)
    else await addFixedDeposit(input)
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? 'Edit Fixed Deposit' : 'Add Fixed Deposit'}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!valid}>
            {editing ? 'Save' : 'Add'}
          </button>
        </div>
      }
    >
      <div className="stack">
        <Field label="Name *">
          <TextInput
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. HDFC 1-year FD"
          />
        </Field>

        <Field label="Principal *">
          <MoneyInput value={principal} onChange={setPrincipal} label="Principal" />
        </Field>

        <div className="grid-2">
          <Field label="Annual rate (%) *">
            <TextInput
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              placeholder="7.25"
            />
          </Field>
          <Field label="Start date">
            <DateField value={startDate} onChange={setStartDate} ariaLabel="Start date" />
          </Field>
        </div>

        <Field
          label="Tenure (months) *"
          hint={`Matures on ${formatDate(maturityDate)}`}
        >
          <TextInput
            type="number"
            inputMode="numeric"
            min={1}
            value={tenure}
            onChange={(event) => setTenure(event.target.value)}
            placeholder="12"
          />
        </Field>

        <FieldGroup label="Interest mode">
          <Segmented
            value={mode}
            onChange={setMode}
            label="Interest mode"
            options={FD_MODES.map((value) => ({
              value,
              label: value === 'Cumulative' ? 'Cumulative' : 'Payout',
            }))}
          />
        </FieldGroup>

        {mode === 'Cumulative' ? (
          <Field
            label="Compounding"
            hint="Quarterly is the usual choice for cumulative bank FDs."
          >
            <Select
              value={compounding}
              onChange={(event) => setCompounding(event.target.value as FdCompounding)}
            >
              {FD_COMPOUNDINGS.map((value) => (
                <option key={value} value={value}>
                  {FD_COMPOUNDING_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p className="tiny muted">
            Payout FDs pay interest out and keep the principal unchanged, so they do not
            compound.
          </p>
        )}

        <Field
          label="Debited from (optional)"
          hint="Creates an expense from this account and reduces its balance."
        >
          <Select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">No account — track only</option>
            {sourceNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Maturity amount (optional)"
          hint="Use the bank's stated maturity value if it differs from the estimate."
        >
          <MoneyInput value={override} onChange={setOverride} label="Maturity amount" />
        </Field>

        <div
          className="card"
          style={{ boxShadow: 'none', background: 'var(--surface-2)' }}
        >
          <div className="row-between">
            <span className="small muted">Maturity value</span>
            <span className="bold">{formatMoney(maturityValue)}</span>
          </div>
          <div className="row-between" style={{ marginTop: 4 }}>
            <span className="small muted">
              {mode === 'Payout' ? 'Total interest (paid out)' : 'Total interest'}
            </span>
            <span>{formatMoney(totalInterest)}</span>
          </div>
          <div className="row-between" style={{ marginTop: 4 }}>
            <span className="small muted">Effective yield</span>
            <span>{formatPercent(effectiveYield * 100, 2)}</span>
          </div>
          <div className="row-between" style={{ marginTop: 4 }}>
            <span className="small muted">Matures on</span>
            <span>{formatDate(maturityDate)}</span>
          </div>
        </div>

        <Field label="Notes">
          <RichTextEditor
            value={notes}
            onValueChange={setNotes}
            placeholder="Optional"
            size="sm"
            ariaLabel="Fixed deposit notes"
          />
        </Field>
      </div>
    </Dialog>
  )
}
