import { db } from './db'
import type {
  CardTxnType,
  CreditCard,
  CreditCardTransaction,
  Transaction,
  TransactionType,
} from './types'
import { clampDay, monthRange } from '../lib/dates'

export const CREDIT_CARD_PAYMENT_CATEGORY = 'Credit Card Payment'

// ---------------------------------------------------------------- accounts

export function totalBankBalance(sources: { balance: number }[]): number {
  return sources.reduce((sum, s) => sum + (s.balance || 0), 0)
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

export async function countTransactionsForSource(name: string): Promise<number> {
  return db.transactions.where('source').equals(name).count()
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

/** Delete a bank transaction, restore the account balance and linked card row. */
export async function deleteTransactionCascade(txn: Transaction): Promise<void> {
  if (txn.id == null) return
  await db.transaction('rw', db.transactions, db.sources, db.creditCardTransactions, async () => {
    await db.transactions.delete(txn.id!)
    await adjustBalance(txn.source, txn.type === 'Income' ? -txn.amount : txn.amount)

    if (txn.linkedCardTxnId != null) {
      await db.creditCardTransactions.delete(txn.linkedCardTxnId)
    } else {
      // Deleting a card payment from the card side removes its bank expense too.
      // `linkedCardTxnId` is not indexed (Dexie cannot index nullable columns
      // usefully here), so scan instead of using where().
      const linked = await db.transactions.filter((t) => t.linkedCardTxnId === txn.id).first()
      if (linked?.id != null) {
        await db.transactions.delete(linked.id)
        await adjustBalance(linked.source, linked.amount)
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
    .filter((t) => t.type === 'Expense' && !isCardPayment(t) && t.date >= start && t.date <= end)
    .reduce((sum, t) => sum + t.amount, 0)
  const card = cardTransactions
    .filter((t) => t.type === 'Purchase' && t.date >= start && t.date <= end)
    .reduce((sum, t) => sum + t.amount, 0)
  return { bank, card, total: bank + card }
}

export async function getCardOutstanding(cardId: number): Promise<number> {
  const txns = await db.creditCardTransactions.where('cardId').equals(cardId).toArray()
  return cardOutstanding(txns)
}

export async function getCardOutstandingInRange(
  cardId: number,
  start: number,
  end: number,
): Promise<number> {
  const txns = await db.creditCardTransactions
    .where('cardId')
    .equals(cardId)
    .filter((t) => t.date >= start && t.date <= end)
    .toArray()
  return cardOutstanding(txns)
}

export async function addCardTransaction(
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

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return { start: start.getTime(), end: end.getTime(), startLabel: fmt(start), endLabel: fmt(new Date(end.getTime() - 1)) }
}

// ---------------------------------------------------------------- metrics

export interface BudgetMetrics {
  income: number
  expenses: number
  net: number
  incomeBySource: [string, number][]
  expensesBySource: [string, number][]
  categorySpending: [string, number][]
  cardSpending: [string, number][]
  totalInvested: number
  totalCurrent: number
  profitLoss: number
}

function groupSum(items: Transaction[], key: (t: Transaction) => string): [string, number][] {
  const map = new Map<string, number>()
  for (const item of items) {
    const k = key(item) || 'Unknown'
    map.set(k, (map.get(k) ?? 0) + item.amount)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

export async function getBudgetMetrics(year: number, month: number): Promise<BudgetMetrics> {
  const [start, end] = monthRange(year, month)
  const [transactions, cards, investments, cardTxns] = await Promise.all([
    db.transactions.toArray(),
    db.creditCards.toArray(),
    db.investments.toArray(),
    db.creditCardTransactions.toArray(),
  ])

  const monthTxns = transactions.filter((t) => t.date >= start && t.date <= end)
  const incomeTxns = monthTxns.filter((t) => t.type === 'Income')
  const expenseTxns = monthTxns.filter((t) => t.type === 'Expense')
  const income = incomeTxns.reduce((s, t) => s + t.amount, 0)
  const expenses = expenseTxns.reduce((s, t) => s + t.amount, 0)

  const cardSpending: [string, number][] = cards
    .map((card) => {
      const spends = cardTxns
        .filter((t) => t.cardId === card.id && t.type === 'Purchase' && t.date >= start && t.date <= end)
        .reduce((s, t) => s + t.amount, 0)
      return [card.name, spends] as [string, number]
    })
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])

  const totalInvested = investments.reduce((s, i) => s + i.units * i.purchasePrice, 0)
  const totalCurrent = investments.reduce((s, i) => s + i.units * i.currentPrice, 0)

  return {
    income,
    expenses,
    net: income - expenses,
    incomeBySource: groupSum(incomeTxns, (t) => t.source),
    expensesBySource: groupSum(expenseTxns, (t) => t.source),
    categorySpending: groupSum(expenseTxns, (t) => t.category),
    cardSpending,
    totalInvested,
    totalCurrent,
    profitLoss: totalCurrent - totalInvested,
  }
}

export function transactionLabel(txn: Transaction): string {
  return txn.description.trim() || txn.category || txn.source || txn.type
}
