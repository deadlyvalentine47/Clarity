import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: process.env.BRAVE_PATH || '/usr/bin/brave',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 430, height: 932 })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const clickIn = async (scope, text) => {
  const ok = await page.evaluate(
    (s, t) => {
      const root = s ? document.querySelector(s) : document
      if (!root) return false
      const el = [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === t && !b.disabled)
      if (!el) return false
      el.click()
      return true
    },
    scope,
    text,
  )
  await sleep(250)
  return ok
}
const clickText = (text) => clickIn(null, text)
const clickDialog = (text) => clickIn('.dialog', text)

const setValue = async (selector, value) => {
  const ok = await page.evaluate(
    (s, v) => {
      const el = document.querySelector(s)
      if (!el) return false
      const proto =
        el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
      setter.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    },
    selector,
    value,
  )
  await sleep(120)
  return ok
}

const setValueAt = async (selector, index, value) => {
  const ok = await page.evaluate(
    (s, i, v) => {
      const el = document.querySelectorAll(s)[i]
      if (!el) return false
      const proto =
        el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
      setter.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    },
    selector,
    index,
    value,
  )
  await sleep(120)
  return ok
}

const dbEval = (fn, ...args) =>
  page.evaluate(
    async (body, a) => {
      const { db } = await import('/src/db/db.ts')
      // eslint-disable-next-line no-new-func
      return new Function('db', 'args', `return (${body})(db, ...args)`)(db, a)
    },
    fn.toString(),
    args,
  )

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
await page.evaluate(() => {
  localStorage.setItem('clarity.preferences', JSON.stringify({ username: 'CJ', darkMode: 'light' }))
})
const ids = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  await Promise.all(db.tables.map((t) => t.clear()))
  const now = Date.now()
  const day = 86_400_000
  const sourceId = await db.sources.add({ name: 'Test Bank', balance: 1000, isDefault: false, createdAt: now })
  await db.categories.add({ name: 'Test Cat', isDefault: false, createdAt: now })
  const habitId = await db.habits.add({
    name: 'Late habit', description: '', frequency: 'Daily', alternateDays: null, selectedDays: null,
    targetCount: 1, currentStreak: 0, bestStreak: 0, completionHistory: {}, lateCompletions: [],
    reminderTime: null, isArchived: false, archivedAt: null, isDeleted: false, deletedAt: null,
    deadlineHour: 0, deadlineMinute: 0, dailyNotes: {}, createdAt: now - 3 * day,
  })
  const noteId = await db.notes.add({
    title: 'Parent note', content: 'parent body', isPinned: false, category: '',
    parentNoteId: null, sortOrder: 10, createdAt: now, updatedAt: now,
  })
  return { sourceId, habitId, noteId, todayKey: new Date().toISOString().slice(0, 10) }
})
console.log('seeded ids', ids)

// 1) Add an expense from the account detail, then verify the balance moved.
await page.goto(`http://localhost:5173/budget/accounts/${ids.sourceId}`, { waitUntil: 'networkidle2' })
await page.click('button[aria-label="Add spend"]')
await sleep(250)
await setValue('.dialog input[inputmode="decimal"]', '100')
await clickDialog('Test Cat')
await clickDialog('Add')
await sleep(400)
let state = await dbEval(async (db) => {
  const source = await db.sources.get(1)
  const txns = await db.transactions.toArray()
  return { balance: source.balance, txns: txns.map((t) => ({ amount: t.amount, category: t.category, source: t.source })) }
})
console.log('expense added:', JSON.stringify(state))

// Delete it from the list, balance should restore.
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button[aria-label="Delete transaction"]')][0]
  btn?.click()
})
await sleep(250)
await clickDialog('Delete')
await sleep(400)
state = await dbEval(async (db) => ({ balance: (await db.sources.get(1)).balance, txns: (await db.transactions.toArray()).length }))
console.log('expense deleted:', JSON.stringify(state))

// 2) Add a card, a purchase, then pay the bill from the bank.
await page.goto('http://localhost:5173/budget/cards', { waitUntil: 'networkidle2' })
await clickText('Card')
await sleep(250)
await setValueAt('.dialog input', 0, 'Test Card')
await setValueAt('.dialog input', 1, '10000')
await setValueAt('.dialog input', 2, '10')
const addCard = await page.evaluate(() => [...document.querySelectorAll('.dialog input')].map((i) => i.value))
console.log('card form values', addCard)
await clickDialog('Add')
await sleep(400)
const cardId = await dbEval(async (db) => (await db.creditCards.toArray())[0]?.id)
console.log('card created id:', cardId)

await page.goto(`http://localhost:5173/budget/cards/${cardId}`, { waitUntil: 'networkidle2' })
await clickText('Spend')
await sleep(250)
await setValue('.dialog input[inputmode="decimal"]', '700')
await setValue('.dialog input[placeholder="Optional"]', 'Card purchase')
await clickDialog('Add')
await sleep(350)

await clickText('Pay bill')
await sleep(250)
await setValue('.dialog input[inputmode="decimal"]', '500')
await page.select('.dialog select', 'Test Bank')
await clickDialog('Pay')
await sleep(500)
state = await dbEval(async (db) => {
  const txns = await db.creditCardTransactions.toArray()
  const bank = await db.transactions.toArray()
  const source = await db.sources.get(1)
  return {
    card: txns.map((t) => ({ type: t.type, amount: t.amount, linked: t.linkedTransactionId != null })),
    bank: bank.map((t) => ({ amount: t.amount, category: t.category, linked: t.linkedCardTxnId != null })),
    balance: source.balance,
  }
})
console.log('card purchase + bill pay:', JSON.stringify(state))

// 3) Investments.
await page.goto('http://localhost:5173/budget/investments', { waitUntil: 'networkidle2' })
await clickText('Investment')
await sleep(250)
await setValueAt('.dialog input', 0, 'Test Fund')
await clickDialog('Mutual Fund')
await setValueAt('.dialog input', 1, '10')
await setValueAt('.dialog input', 3, '100')
await setValueAt('.dialog input', 4, '120')
await clickDialog('Add')
await sleep(400)
const inv = await dbEval(async (db) => (await db.investments.toArray()).map((i) => ({ name: i.name, units: i.units, buy: i.purchasePrice, now: i.currentPrice })))
console.log('investment added:', JSON.stringify(inv))

// 4) Habit day status: done late -> missed -> clear.
await page.goto(`http://localhost:5173/habits/metrics/${ids.todayKey}`, { waitUntil: 'networkidle2' })
await page.click('button[aria-label="Expand"]')
await sleep(300)
await clickText('Done late')
await sleep(350)
const dayState = (key) =>
  dbEval(
    async (db, k) => {
      const h = await db.habits.get(1)
      return { done: h.completionHistory[k], late: h.lateCompletions.includes(k), streak: h.currentStreak }
    },
    key,
  )
let habit = await dayState(ids.todayKey)
console.log('habit late:', JSON.stringify(habit))
await clickText('Missed')
await sleep(350)
habit = await dayState(ids.todayKey)
console.log('habit missed:', JSON.stringify(habit))
await clickText('Clear')
await sleep(350)
habit = await dayState(ids.todayKey)
console.log('habit cleared:', JSON.stringify(habit))

// 5) Notes: add a child page and check the parent link.
await page.goto(`http://localhost:5173/notes/${ids.noteId}`, { waitUntil: 'networkidle2' })
await clickText('Add page')
await sleep(200)
await setValue('.dialog input', 'Child note')
await clickDialog('Add')
await sleep(400)
const child = await dbEval(async (db) => (await db.notes.toArray()).map((n) => ({ title: n.title, parent: n.parentNoteId })))
console.log('child page:', JSON.stringify(child))

// 6) Home section toggle.
await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle2' })
const toggled = await page.evaluate(() => {
  const row = [...document.querySelectorAll('.section-config-row')].find((r) => r.textContent?.includes('Tasks'))
  const sw = row?.querySelector('.switch')
  sw?.click()
  return !!sw
})
await sleep(300)
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
await sleep(300)
const homeText = await page.evaluate(() => document.body.innerText)
console.log('tasks section hidden:', toggled, !homeText.includes('OVERDUE'))
// restore
await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle2' })
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.section-config-row')].find((r) => r.textContent?.includes('Tasks'))
  row?.querySelector('.switch')?.click()
})
await sleep(200)

// 7) Export/import round trip with all phase-2 tables and ID remapping.
const roundTrip = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  const { exportData, importData } = await import('/src/lib/exportImport.ts')
  const { loadPreferences } = await import('/src/lib/prefs.ts')
  const json = await exportData(loadPreferences())
  const snap = async () => ({
    notes: (await db.notes.toArray()).map((n) => ({ id: n.id, title: n.title, parent: n.parentNoteId })),
    cards: (await db.creditCards.toArray()).map((c) => ({ id: c.id, name: c.name })),
    cardTxns: (await db.creditCardTransactions.toArray()).map((t) => ({ id: t.id, cardId: t.cardId, type: t.type, linked: t.linkedTransactionId })),
    investments: await db.investments.count(),
    journals: await db.dayJournals.count(),
  })
  const before = await snap()
  await Promise.all(db.tables.map((t) => t.clear()))
  await importData(json)
  const after = await snap()
  const card = after.cards[0]
  const cardTxn = after.cardTxns[0]
  return {
    before,
    after,
    parentRemapped: after.notes.find((n) => n.title === 'Child note')?.parent === after.notes.find((n) => n.title === 'Parent note')?.id,
    cardTxnRemapped: card != null && cardTxn != null ? cardTxn.cardId === card.id : true,
    countsKept: before.investments === after.investments && before.journals === after.journals,
  }
})
console.log('round trip:', JSON.stringify(roundTrip))

// 8) Home: greeting, quick add task, complete from home, habit chip, collapse.
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
await sleep(300)
const greeting = await page.evaluate(() => document.querySelector('.home-greeting')?.textContent ?? '')

await clickText('Task')
await sleep(250)
await setValue('.dialog input', 'Home quick task')
await clickDialog('Add')
await sleep(400)
const created = await dbEval(async (db) => (await db.tasks.toArray()).some((t) => t.title === 'Home quick task'))
// A task with no due date must be visible (previously it vanished from Home).
const noDateGroup = await page.evaluate(() => document.body.innerText.includes('NO DATE'))
console.log('home quick add task:', JSON.stringify({ greeting, created, noDateGroup }))

await page.evaluate(() => {
  const row = [...document.querySelectorAll('.home-task')].find((r) => r.textContent?.includes('Home quick task'))
  row?.querySelector('.task-check')?.click()
})
await sleep(400)
const completed = await dbEval(async (db) => {
  const t = (await db.tasks.toArray()).find((x) => x.title === 'Home quick task')
  return t?.isCompleted === true
})
console.log('home completes task:', completed)

const chipLabel = await page.evaluate(() => {
  const chip = document.querySelector('.habit-chip')
  if (!chip) return null
  const label = chip.getAttribute('aria-label')
  chip.click()
  return label
})
await sleep(400)
const habitState = await dbEval(async (db) => {
  const h = (await db.habits.toArray()).find((x) => x.name === 'Late habit')
  if (!h) return null
  const key = Object.keys(h.completionHistory).sort().pop()
  return { done: h.completionHistory[key] === true, late: h.lateCompletions.includes(key) }
})
console.log('home habit chip:', JSON.stringify({ chipLabel, habitState }))

// Collapse persists across a reload.
await page.evaluate(() => {
  const head = [...document.querySelectorAll('.collapse-head')].find((b) => b.textContent?.includes('Tasks'))
  head?.click()
})
await sleep(250)
await page.reload({ waitUntil: 'networkidle2' })
await sleep(300)
const collapsed = await page.evaluate(() => {
  const head = [...document.querySelectorAll('.collapse-head')].find((b) => b.textContent?.includes('Tasks'))
  return head?.getAttribute('aria-expanded')
})
console.log('home collapse persisted:', collapsed === 'false')
await page.evaluate(() => {
  const head = [...document.querySelectorAll('.collapse-head')].find((b) => b.textContent?.includes('Tasks'))
  head?.click()
})
await sleep(250)

// Quick add spend from home counts towards the budget card.
await clickText('Spend')
await sleep(250)
await setValue('.dialog input[inputmode="decimal"]', '50')
await clickDialog('Test Cat')
await clickDialog('Test Bank')
await clickDialog('Add')
await sleep(500)
const quickSpend = await dbEval(async (db) => {
  const txns = await db.transactions.toArray()
  return { count: txns.filter((t) => t.amount === 50 && t.category === 'Test Cat').length }
})
console.log('home quick add spend:', JSON.stringify(quickSpend))

console.log('\nERRORS:', errors.length)
errors.slice(0, 20).forEach((e) => console.log(' -', e))
await browser.close()
