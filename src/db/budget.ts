import { db } from './db'
import type {
  CardTxnType,
  CreditCardTransaction,
  Investment,
  Source,
  Transaction,
  TransactionType,
} from './types'
import { clampDay, formatDate } from '../lib/dates'

export const CREDIT_CARD_PAYMENT_CATEGORY = 'Credit Card Payment'
export const SELF_TRANSFER_CATEGORY = 'Self_Transfer'

// ---------------------------------------------------------------- accounts

export function totalBankBalance(sources: { balance: number }[]): number {
  return sources.reduce((sum, s) => sum + (s.balance || 0), 0)
}

export interface BudgetTotals {
  bankBalance: number
  /** net across all cards: negative means the cards are in credit */
  cardOutstanding: number
  cardDebt: number
  cardCredit: number
  investmentValue: number
  netWorth: number
}

/**
 * One convention for the hub, home and metrics. Card balances are netted
 * across cards (a credit card overpayment offsets another card's debt) instead
 * of clamping each card at zero.
 */
export function summarizeBudget(input: {
  sources: Source[]
  cardTxns: CreditCardTransaction[]
  investments?: Investment[]
}): BudgetTotals {
  const bankBalance = totalBankBalance(input.sources)
  const outstanding = cardOutstanding(input.cardTxns)
  const cardDebt = Math.max(0, outstanding)
  const cardCredit = Math.max(0, -outstanding)
  const investmentValue = (input.investments ?? []).reduce(
    (sum, item) => sum + item.units * item.currentPrice,
    0,
  )
  return {
    bankBalance,
    cardOutstanding: outstanding,
    cardDebt,
    cardCredit,
    investmentValue,
    netWorth: bankBalance + investmentValue + cardCredit - cardDebt,
  }
}

export async function sourceNameExists(name: string, exceptId?: number): Promise<boolean> {
  const trimmed = name.trim().toLowerCase()
  const sources = await db.sources.toArray()
  return sources.some((s) => s.id !== exceptId && s.name.trim().toLowerCase() === trimmed)
}

export async function categoryNameExists(name: string, exceptId?: number): Promise<boolean> {
  const trimmed = name.trim().toLowerCase()
  const categories = await db.categories.toArray()
  return categories.some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === trimmed)
}

export async function cardNameExists(name: string, exceptId?: number): Promise<boolean> {
  const trimmed = name.trim().toLowerCase()
  const cards = await db.creditCards.toArray()
  return cards.some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === trimmed)
}

/** Rename an account and cascade the name to every transaction. */
export async function renameSource(id: number, newName: string): Promise<void> {
  const source = await db.sources.get(id)
  if (!source) return
  const oldName = source.name
  const name = newName.trim()
  await db.transaction('rw', db.sources, db.transactions, async () => {
    await db.sources.update(id, { name })
    if (oldName !== name) {
      await db.transactions.where('source').equals(oldName).modify({ source: name })
    }
  })
}

export async function renameCategory(id: number, newName: string): Promise<void> {
  const category = await db.categories.get(id)
  if (!category) return
  const oldName = category.name
  const name = newName.trim()
  await db.transaction('rw', db.categories, db.transactions, async () => {
    await db.categories.update(id, { name })
    if (oldName !== name) {
      await db.transactions.where('category').equals(oldName).modify({ category: name })
    }
  })
}

export async function deleteSource(id: number): Promise<void> {
  await db.sources.delete(id)
}

export async function deleteCategory(id: number): Promise<void> {
  await db.categories.delete(id)
}

// ------------------------------------------------------------ transactions

async function adjustBalance(sourceName: string, delta: number): Promise<void> {
  const source = await db.sources.where('name').equals(sourceName).first()
  if (!source || source.id == null) return
  await db.sources.update(source.id, { balance: (source.balance || 0) + delta })
}

export async function addIncome(input: {
  amount: number
  source: string
  category: string
  description: string
  date?: number
}): Promise<number> {
  const now = Date.now()
  return db.transaction('rw', db.transactions, db.sources, async () => {
    const id = await db.transactions.add({
      type: 'Income',
      amount: input.amount,
      category: input.category || 'Income',
      source: input.source,
      description: input.description.trim(),
      date: input.date ?? now,
      isRecurring: false,
      recurringType: null,
      createdAt: now,
    })
    await adjustBalance(input.source, input.amount)
    return id as number
  })
}

export async function addExpense(input: {
  amount: number
  source: string
  category: string
  description: string
  date?: number
}): Promise<number> {
  const now = Date.now()
  return db.transaction('rw', db.transactions, db.sources, async () => {
    const id = await db.transactions.add({
      type: 'Expense',
      amount: input.amount,
      category: input.category,
      source: input.source,
      description: input.description.trim(),
      date: input.date ?? now,
      isRecurring: false,
      recurringType: null,
      createdAt: now,
    })
    await adjustBalance(input.source, -input.amount)
    return id as number
  })
}

/** A self-transfer moves money between your own accounts; it is not spending. */
export function isSelfTransfer(txn: Transaction): boolean {
  return txn.transferGroupId != null || txn.category === SELF_TRANSFER_CATEGORY
}

export interface TransactionInput {
  type: TransactionType
  amount: number
  category: string
  source: string
  description: string
  date: number
}

/** Edit a plain bank transaction and keep the account balance in sync. */
export async function updateTransaction(txn: Transaction, patch: TransactionInput): Promise<void> {
  if (txn.id == null) return
  await db.transaction('rw', db.transactions, db.sources, async () => {
    // Undo the old effect, apply the new one.
    await adjustBalance(txn.source, txn.type === 'Income' ? -txn.amount : txn.amount)
    await db.transactions.update(txn.id!, {
      type: patch.type,
      amount: patch.amount,
      category: patch.category,
      source: patch.source,
      description: patch.description.trim(),
      date: patch.date,
    })
    await adjustBalance(patch.source, patch.type === 'Income' ? patch.amount : -patch.amount)
  })
}

/**
 * Move money between two of your own accounts: one expense leg from the source
 * and one income leg to the destination, sharing a group id.
 */
export async function addSelfTransfer(input: {
  fromSource: string
  toSource: string
  amount: number
  description: string
  date?: number
}): Promise<string> {
  const now = Date.now()
  const date = input.date ?? now
  const groupId = crypto.randomUUID()
  const label = input.description.trim()

  await db.transaction('rw', db.transactions, db.sources, async () => {
    await db.transactions.add({
      type: 'Expense',
      amount: input.amount,
      category: SELF_TRANSFER_CATEGORY,
      source: input.fromSource,
      description: label || `Transfer to ${input.toSource}`,
      date,
      isRecurring: false,
      recurringType: null,
      createdAt: now,
      transferGroupId: groupId,
    })
    await db.transactions.add({
      type: 'Income',
      amount: input.amount,
      category: SELF_TRANSFER_CATEGORY,
      source: input.toSource,
      description: label || `Transfer from ${input.fromSource}`,
      date,
      isRecurring: false,
      recurringType: null,
      createdAt: now,
      transferGroupId: groupId,
    })
    await adjustBalance(input.fromSource, -input.amount)
    await adjustBalance(input.toSource, input.amount)
  })

  return groupId
}

/** Update both legs of a self-transfer and rebalance both accounts. */
export async function updateSelfTransfer(
  groupId: string,
  patch: {
    fromSource: string
    toSource: string
    amount: number
    description: string
    date: number
  },
): Promise<void> {
  const legs = await db.transactions.filter((t) => t.transferGroupId === groupId).toArray()
  const expenseLeg = legs.find((t) => t.type === 'Expense')
  const incomeLeg = legs.find((t) => t.type === 'Income')
  if (!expenseLeg || !incomeLeg || expenseLeg.id == null || incomeLeg.id == null) {
    throw new Error('Transfer pair not found')
  }

  await db.transaction('rw', db.transactions, db.sources, async () => {
    // Reverse the old movement before applying the new one.
    await adjustBalance(expenseLeg.source, expenseLeg.amount)
    await adjustBalance(incomeLeg.source, -incomeLeg.amount)

    const label = patch.description.trim()
    await db.transactions.update(expenseLeg.id!, {
      type: 'Expense',
      amount: patch.amount,
      category: SELF_TRANSFER_CATEGORY,
      source: patch.fromSource,
      description: label || `Transfer to ${patch.toSource}`,
      date: patch.date,
    })
    await db.transactions.update(incomeLeg.id!, {
      type: 'Income',
      amount: patch.amount,
      category: SELF_TRANSFER_CATEGORY,
      source: patch.toSource,
      description: label || `Transfer from ${patch.fromSource}`,
      date: patch.date,
    })
    await adjustBalance(patch.fromSource, -patch.amount)
    await adjustBalance(patch.toSource, patch.amount)
  })
}

/** Resolve the from/to accounts of a transfer leg. */
export function transferPair(
  transactions: Transaction[],
  txn: Transaction,
): { from: string; to: string } | null {
  if (txn.transferGroupId == null) return null
  const legs = transactions.filter((t) => t.transferGroupId === txn.transferGroupId)
  const from = legs.find((t) => t.type === 'Expense')?.source
  const to = legs.find((t) => t.type === 'Income')?.source
  return from != null && to != null ? { from, to } : null
}

/** Delete a bank transaction, restore the account balance and linked card row. */
export async function deleteTransactionCascade(txn: Transaction): Promise<void> {
  if (txn.id == null) return
  await db.transaction('rw', db.transactions, db.sources, db.creditCardTransactions, async () => {
    // Delete both legs of a self-transfer together.
    if (txn.transferGroupId != null) {
      const legs = await db.transactions
        .filter((t) => t.transferGroupId === txn.transferGroupId)
        .toArray()
      for (const leg of legs) {
        if (leg.id == null) continue
        await db.transactions.delete(leg.id)
        await adjustBalance(leg.source, leg.type === 'Income' ? -leg.amount : leg.amount)
      }
      return
    }

    await db.transactions.delete(txn.id!)
    await adjustBalance(txn.source, txn.type === 'Income' ? -txn.amount : txn.amount)

    if (txn.linkedCardTxnId != null) {
      await db.creditCardTransactions.delete(txn.linkedCardTxnId)
    } else {
      // Older/imported data may only carry the card-side backlink. Remove the
      // card payment that points at this bank row so outstanding doesn't drift.
      // `linkedTransactionId` is not indexed, so scan with filter().
      const linkedCard = await db.creditCardTransactions
        .filter((c) => c.linkedTransactionId === txn.id)
        .first()
      if (linkedCard?.id != null) {
        await db.creditCardTransactions.delete(linkedCard.id)
      }
    }
  })
}

// ------------------------------------------------------------ credit cards

export function cardOutstanding(transactions: { type: CardTxnType; amount: number }[]): number {
  return transactions.reduce((sum, t) => {
    if (t.type === 'Purchase') return sum + t.amount
    return sum - t.amount // Payment | Credit
  }, 0)
}

export function cardUsage(outstanding: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(1, Math.max(0, outstanding / limit))
}

/**
 * A bank expense that only moves money to a card is a transfer, not new
 * spending. Counting it next to the card purchases would double-count.
 */
export function isCardPayment(txn: Transaction): boolean {
  return txn.linkedCardTxnId != null || txn.category === CREDIT_CARD_PAYMENT_CATEGORY
}

export interface SpendSummary {
  /** Bank expenses, excluding credit-card bill payments. */
  bank: number
  /** Credit-card purchases (money spent even before the bill is paid). */
  card: number
  total: number
}

/** Everything actually spent in a window: bank expenses + card purchases. */
export function spendSummary(
  transactions: Transaction[],
  cardTransactions: CreditCardTransaction[],
  start: number,
  end: number,
): SpendSummary {
  const bank = transactions
    .filter((t) => t.type === 'Expense' && !isCardPayment(t) && !isSelfTransfer(t) && t.date >= start && t.date <= end)
    .reduce((sum, t) => sum + t.amount, 0)
  const card = cardTransactions
    .filter((t) => t.type === 'Purchase' && t.date >= start && t.date <= end)
    .reduce((sum, t) => sum + t.amount, 0)
  return { bank, card, total: bank + card }
}

/**
 * Purchases on a card inside the billing cycle that ends in the given month —
 * the same window the card detail screen uses for that month.
 */
export function cardPurchasesInCycle(
  card: { id?: number; billingCycleDay: number },
  cardTransactions: CreditCardTransaction[],
  year: number,
  month: number,
): number {
  if (card.id == null) return 0
  const cycle = billingCycle(year, month, card.billingCycleDay)
  return cardTransactions
    .filter(
      (t) =>
        t.cardId === card.id &&
        t.type === 'Purchase' &&
        t.date >= cycle.start &&
        t.date < cycle.end,
    )
    .reduce((sum, t) => sum + t.amount, 0)
}

export interface DailySummary {
  spent: number
  earned: number
}

/** Spent and earned in a window; self-transfers and bill payments are excluded. */
export function dailySummary(
  transactions: Transaction[],
  cardTransactions: CreditCardTransaction[],
  start: number,
  end: number,
): DailySummary {
  const spent = spendSummary(transactions, cardTransactions, start, end).total
  const earned =
    transactions
      .filter((t) => t.type === 'Income' && !isSelfTransfer(t) && t.date >= start && t.date <= end)
      .reduce((sum, t) => sum + t.amount, 0) +
    cardTransactions
      .filter((t) => t.type === 'Credit' && t.date >= start && t.date <= end)
      .reduce((sum, t) => sum + t.amount, 0)
  return { spent, earned }
}

/** Record a spend/credit straight onto a card (budget quick-add). */
export async function recordCardTransaction(
  cardId: number,
  type: CardTxnType,
  amount: number,
  description: string,
  date: number = Date.now(),
): Promise<number> {
  return db.creditCardTransactions.add({
    cardId,
    amount,
    description: description.trim(),
    date,
    type,
    createdAt: Date.now(),
  }) as Promise<number>
}

/** Delete a card transaction; also removes a linked bank bill payment. */
export async function deleteCardTransaction(txnId: number): Promise<void> {
  await db.transaction('rw', db.creditCardTransactions, db.transactions, db.sources, async () => {
    const txn = await db.creditCardTransactions.get(txnId)
    if (!txn) return
    await db.creditCardTransactions.delete(txnId)

    if (txn.linkedTransactionId != null) {
      const linked = await db.transactions.get(txn.linkedTransactionId)
      if (linked?.id != null) {
        await db.transactions.delete(linked.id)
        await adjustBalance(linked.source, linked.amount)
      }
    }
  })
}

export async function deleteCardCascade(cardId: number): Promise<void> {
  await db.transaction('rw', db.creditCards, db.creditCardTransactions, db.transactions, db.sources, async () => {
    const cardTxns = await db.creditCardTransactions.where('cardId').equals(cardId).toArray()
    const cardTxnIds = new Set(cardTxns.map((t) => t.id).filter((id): id is number => id != null))

    // Remove linked bank bill payments so the two sides never drift.
    for (const txn of cardTxns) {
      if (txn.linkedTransactionId != null) {
        const linked = await db.transactions.get(txn.linkedTransactionId)
        if (linked?.id != null) {
          await db.transactions.delete(linked.id)
          await adjustBalance(linked.source, linked.amount)
        }
      }
    }

    // Older/imported data may only carry the bank-side link. Only touch rows
    // that point at *this* card's transactions, never another card's.
    if (cardTxnIds.size > 0) {
      const dangling = await db.transactions
        .filter((t) => t.linkedCardTxnId != null && cardTxnIds.has(t.linkedCardTxnId))
        .toArray()
      for (const txn of dangling) {
        if (txn.id == null) continue
        await db.transactions.delete(txn.id)
        await adjustBalance(txn.source, txn.amount)
      }
    }

    await db.creditCardTransactions.where('cardId').equals(cardId).delete()
    await db.creditCards.delete(cardId)
  })
}

/** Pay a credit-card bill from a bank account (creates both sides atomically). */
export async function payCardBill(input: {
  cardId: number
  amount: number
  source: string
  description: string
}): Promise<void> {
  const card = await db.creditCards.get(input.cardId)
  if (!card) throw new Error('Card not found')
  const now = Date.now()

  await db.transaction('rw', db.transactions, db.sources, db.creditCardTransactions, async () => {
    const cardTxnId = (await db.creditCardTransactions.add({
      cardId: input.cardId,
      amount: input.amount,
      description: `Bill Payment - ${input.description.trim()}`.trim(),
      date: now,
      type: 'Payment',
      createdAt: now,
    })) as number

    const bankTxnId = (await db.transactions.add({
      type: 'Expense',
      amount: input.amount,
      category: CREDIT_CARD_PAYMENT_CATEGORY,
      source: input.source,
      description: input.description.trim() || `Payment to ${card.name}`,
      date: now,
      isRecurring: false,
      recurringType: null,
      createdAt: now,
      linkedCardTxnId: cardTxnId,
    })) as number

    await db.creditCardTransactions.update(cardTxnId, { linkedTransactionId: bankTxnId })
    await adjustBalance(input.source, -input.amount)
  })
}

export interface BillingCycle {
  /** inclusive start */
  start: number
  /** exclusive end */
  end: number
  startLabel: string
  endLabel: string
}

/**
 * Billing window for the statement cycle that *ends* in the given month:
 * [prevMonth/cycleDay, month/cycleDay). Clamps day 29–31 in short months.
 * This matches how statements are labelled ("Oct 15 – Nov 14" for November).
 */
export function billingCycle(year: number, month: number, cycleDay: number): BillingCycle {
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const startDay = clampDay(prevYear, prevMonth, cycleDay)
  const start = new Date(prevYear, prevMonth - 1, startDay, 0, 0, 0, 0)
  const endDay = clampDay(year, month, cycleDay)
  const end = new Date(year, month - 1, endDay, 0, 0, 0, 0)

  const fmt = (d: Date) => formatDate(d)
  return { start: start.getTime(), end: end.getTime(), startLabel: fmt(start), endLabel: fmt(new Date(end.getTime() - 1)) }
}

