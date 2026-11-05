import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = process.env.CLARITY_SHOTS || join(tmpdir(), 'clarity-shots')
fs.mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: process.env.BRAVE_PATH || '/usr/bin/brave',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
})

const page = await browser.newPage()
await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 1 })

const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`)
})
page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`))

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })

// Mark onboarding complete.
await page.evaluate(() => {
  localStorage.setItem('clarity.preferences', JSON.stringify({ username: 'CJ', darkMode: false }))
})

// Seed demo data through the app's own Dexie module (Vite dev serves it).
const seeded = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  // Clear tables rather than delete/reopen so schema stays intact and no
  // duplicate defaults can appear.
  await Promise.all(db.tables.map((t) => t.clear()))
  const now = Date.now()
  const day = 86_400_000
  const todayKey = new Date().toISOString().slice(0, 10)
  const habitId = await db.habits.add({
    name: 'Drink water', description: '8 glasses', frequency: 'Daily', alternateDays: null, selectedDays: null,
    targetCount: 1, currentStreak: 3, bestStreak: 5, completionHistory: { [todayKey]: true }, lateCompletions: [],
    reminderTime: null, isArchived: false, archivedAt: null, isDeleted: false, deletedAt: null,
    deadlineHour: null, deadlineMinute: null, dailyNotes: {}, createdAt: now - 6 * day,
  })
  await db.habits.add({
    name: 'Meditate', description: '', frequency: 'Daily', alternateDays: null, selectedDays: null,
    targetCount: 1, currentStreak: 0, bestStreak: 2, completionHistory: {}, lateCompletions: [],
    reminderTime: null, isArchived: false, archivedAt: null, isDeleted: false, deletedAt: null,
    deadlineHour: 21, deadlineMinute: 0, dailyNotes: {}, createdAt: now - 1000,
  })
  await db.notes.bulkAdd([
    { title: 'Project ideas', content: '# Ideas\n- **Clarity web**\n- *Weekly review* template\n\n1. Ship it', isPinned: true, category: 'Ideas', parentNoteId: null, sortOrder: 10, createdAt: now, updatedAt: now },
    { title: 'Meeting notes', content: 'Discussed roadmap and **priorities**.', isPinned: false, category: 'Work', parentNoteId: null, sortOrder: 20, createdAt: now - day, updatedAt: now - day },
  ])
  const notes = await db.notes.toArray()
  await db.noteCategories.bulkAdd([{ name: 'Ideas', createdAt: now }, { name: 'Work', createdAt: now }])
  await db.categories.bulkAdd([{ name: 'Food', isDefault: true, createdAt: now }, { name: 'Transport', isDefault: true, createdAt: now }, { name: 'Travel', isDefault: true, createdAt: now }])
  await db.sources.bulkAdd([
    { name: 'Bank Account', balance: 50000, isDefault: true, createdAt: now },
    { name: 'Credit Card', balance: 0, isDefault: true, createdAt: now },
  ])
  await db.transactions.bulkAdd([
    { type: 'Expense', amount: 420.5, category: 'Food', source: 'Credit Card', description: 'Groceries', date: now, isRecurring: false, recurringType: null, createdAt: now },
    { type: 'Expense', amount: 90, category: 'Transport', source: 'Bank Account', description: 'Metro card', date: now - day, isRecurring: false, recurringType: null, createdAt: now },
    { type: 'Income', amount: 52000, category: 'Income', source: 'Bank Account', description: 'Salary', date: now - 2 * day, isRecurring: false, recurringType: null, createdAt: now },
  ])
  const cardId = await db.creditCards.add({ name: 'HDFC Regalia', creditLimit: 200000, billingCycleDay: 15, createdAt: now })
  await db.creditCardTransactions.bulkAdd([
    { cardId, amount: 420.5, description: 'Groceries', date: now, type: 'Purchase', createdAt: now },
    { cardId, amount: 2000, description: 'Bill payment', date: now - 3 * day, type: 'Payment', createdAt: now },
  ])
  await db.investments.bulkAdd([
    { name: 'Nifty 50 Index Fund', type: 'Mutual Fund', units: 100, purchasePrice: 120, currentPrice: 135, purchaseDate: now - 20 * day, notes: '', createdAt: now },
    { name: 'Bluechip Stock', type: 'Stock', units: 20, purchasePrice: 1500, currentPrice: 1420, purchaseDate: now - 2 * day, notes: '', createdAt: now },
  ])
  await db.dayJournals.put({ date: todayKey, content: 'A focused day.', updatedAt: now })
  await db.goals.bulkAdd([
    { title: 'Read 12 books', description: 'One per month', type: 'Long-term', progress: 0.5, targetDate: now + 30 * day, milestones: ['Q1', 'Q2', 'Q3', 'Q4'], completedMilestones: ['Q1', 'Q2'], isCompleted: false, createdAt: now },
    { title: 'Launch side project', description: '', type: 'Short-term', progress: 1, targetDate: null, milestones: [], completedMilestones: [], isCompleted: true, createdAt: now },
  ])
  await db.events.bulkAdd([
    { title: 'Team sync', description: 'Weekly standup', startDate: now + 3600_000, endDate: now + 7200_000, category: 'Work', color: '#4A90D9', isAllDay: false, reminderTime: null, priority: 'High', dueDate: null, frequency: 'Weekly', alternateDays: null, selectedDays: null, completionHistory: {}, createdAt: now },
    { title: 'Dentist', description: '', startDate: now + day + 3600_000, endDate: now + day + 7200_000, category: 'Health', color: '#7B61FF', isAllDay: false, reminderTime: null, priority: null, dueDate: now + day + 3600_000, frequency: null, alternateDays: null, selectedDays: null, completionHistory: {}, createdAt: now },
  ])
  const sid = await db.pomodoroFocusSessions.add({ title: 'Deep work', focusDurationMinutes: 25, breakDurationMinutes: 5, sessionCount: 2, totalFocusMinutes: 50, distractions: 'Phone - 10:15', createdAt: now, updatedAt: now })
  await db.pomodoroSessions.bulkAdd([
    { duration: 25, type: 'Focus', completedAt: now, distractions: [] },
    { duration: 25, type: 'Focus', completedAt: now - day, distractions: [] },
  ])
  const runPoints = Array.from({ length: 11 }, (_, i) => ({
    t: now - 2 * day + i * 180_000,
    lat: 19.076 + i * 0.0045,
    lng: 72.8777,
    acc: 4,
    // A rolling profile so the smoke run exercises the 3D route view too.
    alt: 20 + Math.sin(i / 1.5) * 9,
    spd: 2.8,
  }))
  const runId = await db.runs.add({
    startedAt: now - 2 * day,
    endedAt: now - 2 * day + 1_800_000,
    durationSeconds: 1800,
    distanceMeters: 5000,
    isManualDistance: false,
    points: runPoints,
    notes: 'Morning loop',
    createdAt: now - 2 * day,
  })
  return { sid, habitId, noteId: notes[0].id, cardId, todayKey, runId }
})
console.log('seeded', seeded)

// Dark home with data (the rest of the run stays light).
await page.evaluate(() => {
  localStorage.setItem('clarity.preferences', JSON.stringify({ username: 'CJ', darkMode: 'dark' }))
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 400))
await page.screenshot({ path: `${OUT}/home-dark.png`, fullPage: true })
await page.evaluate(() => {
  localStorage.setItem('clarity.preferences', JSON.stringify({ username: 'CJ', darkMode: 'light' }))
})

const routes = [
  ['home', '/'],
  ['calendar', '/calendar'],
  ['budget-hub', '/budget'],
  ['budget-accounts', '/budget/accounts'],
  ['budget-account-detail', '/budget/accounts/1'],
  ['budget-cards', '/budget/cards'],
  ['budget-card-detail', `/budget/cards/${seeded.cardId}`],
  ['budget-investments', '/budget/investments'],
  ['budget-metrics', '/budget/metrics'],
  ['budget-activity', '/budget/activity'],
  ['budget-transactions', '/budget/transactions'],
  ['habits', '/habits'],
  ['habit-detail', `/habits/${seeded.habitId}`],
  ['habit-metrics', '/habits/metrics'],
  ['habit-metrics-day', `/habits/metrics/${seeded.todayKey}`],
  ['runs', '/runs'],
  ['run-detail', `/runs/${seeded.runId}`],
  ['notes', '/notes'],
  ['note-detail', `/notes/${seeded.noteId}`],
  ['goals', '/goals'],
  ['pomodoro-list', '/pomodoro'],
  ['pomodoro-session', `/pomodoro/${seeded.sid}`],
  ['settings', '/settings'],
]

for (const [name, route] of routes) {
  await page.goto(`http://localhost:5173${route}`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 400))
  const body = await page.evaluate(() => document.body.innerText.slice(0, 200))
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  console.log(`--- ${name} ${route} ---`)
  console.log(body.replace(/\n+/g, ' | '))
}

// Budget hub navigation cards.
for (const [label, expected] of [
  ['Accounts', '/budget/accounts'],
  ['Credit Cards', '/budget/cards'],
  ['Investments', '/budget/investments'],
  ['Metrics', '/budget/metrics'],
]) {
  await page.goto('http://localhost:5173/budget', { waitUntil: 'networkidle2' })
  const clicked = await page.evaluate((text) => {
    const el = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text))
    if (el) el.click()
    return !!el
  }, label)
  await new Promise((r) => setTimeout(r, 400))
  console.log(`budget nav ${label}: clicked=${clicked} url=${new URL(page.url()).pathname} expected=${expected}`)
}

// Empty home (fresh install) — every section should be one compact line.
await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  await Promise.all(db.tables.map((t) => t.clear()))
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 400))
await page.screenshot({ path: `${OUT}/home-empty.png`, fullPage: true })
console.log('--- home-empty / ---')
console.log((await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | '))

// Open note detail
await page.goto('http://localhost:5173/notes', { waitUntil: 'networkidle2' })
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.card.clickable')][0]
  el?.click()
})
await new Promise((r) => setTimeout(r, 400))
await page.screenshot({ path: `${OUT}/note-detail.png`, fullPage: true })
console.log('note detail url:', page.url())

console.log('\nERRORS:', errors.length)
for (const e of errors.slice(0, 30)) console.log(e)

await browser.close()
