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
await page.setViewport({ width: 430, height: 932 })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const clickText = async (text, selector = 'button') => {
  const ok = await page.evaluate(
    (t, s) => {
      const el = [...document.querySelectorAll(s)].find((b) => b.textContent?.trim() === t)
      if (el) {
        el.click()
        return true
      }
      return false
    },
    text,
    selector,
  )
  await sleep(250)
  return ok
}

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
await page.evaluate(() => {
  localStorage.setItem('clarity.preferences', JSON.stringify({ username: 'CJ', darkMode: false }))
})
await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  const now = Date.now()
  await Promise.all([
    db.habits.clear(),
    db.categories.clear(),
    db.sources.clear(),
    db.transactions.clear(),
    db.events.clear(),
    db.pomodoroFocusSessions.clear(),
  ])
  await db.habits.bulkAdd([
    { name: 'Drink water', description: '8 glasses', frequency: 'Daily', alternateDays: null, selectedDays: null, targetCount: 1, currentStreak: 0, bestStreak: 2, completionHistory: {}, lateCompletions: [], reminderTime: null, isArchived: false, archivedAt: null, isDeleted: false, deletedAt: null, deadlineHour: null, deadlineMinute: null, dailyNotes: {}, createdAt: now },
  ])
  await db.categories.bulkAdd([{ name: 'Food', isDefault: true, createdAt: now }])
  await db.sources.bulkAdd([{ name: 'Bank Account', isDefault: true, createdAt: now }])
  await db.pomodoroFocusSessions.add({ title: 'Deep work', focusDurationMinutes: 25, breakDurationMinutes: 5, sessionCount: 0, totalFocusMinutes: 0, distractions: '', createdAt: now, updatedAt: now })
})

await page.goto('http://localhost:5173/calendar', { waitUntil: 'networkidle2' })

// --- Add an event with priority + recurrence through the dialog ---
await page.click('.fab')
await sleep(250)
await page.type('.dialog input', 'Test event from browser')
const selects = await page.$$('.dialog select')
if (selects[0]) await selects[0].select('High')
if (selects[1]) await selects[1].select('Weekly')
const added = await clickText('Add')
await sleep(400)
const eventState = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  const e = (await db.events.toArray()).find((x) => x.title === 'Test event from browser')
  return e ? { priority: e.priority, frequency: e.frequency } : null
})
console.log('event dialog opened/add clicked:', added, '| event:', JSON.stringify(eventState))

// --- Habits toggle ---
await page.goto('http://localhost:5173/habits', { waitUntil: 'networkidle2' })
const habitToggled = await page.evaluate(async () => {
  const buttons = [...document.querySelectorAll('button[aria-label="Mark done"]')]
  if (!buttons.length) return false
  buttons[0].click()
  await new Promise((r) => setTimeout(r, 300))
  const { db } = await import('/src/db/db.ts')
  const habits = await db.habits.toArray()
  return habits.some((h) => Object.values(h.completionHistory).some(Boolean))
})
console.log('habit toggled:', habitToggled)

// --- Add transaction ---
await page.goto('http://localhost:5173/budget', { waitUntil: 'networkidle2' })
await page.click('.fab')
await sleep(250)
await page.type('.dialog input[inputmode="decimal"]', '12.34')
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('.dialog input')]
  const desc = inputs.find((i) => i.placeholder === 'Optional')
  if (desc) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(desc, 'Browser expense')
    desc.dispatchEvent(new Event('input', { bubbles: true }))
  }
})
await clickText('Food')
await clickText('Bank Account')
const txAdded = await clickText('Add')
await sleep(400)
const txCount = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  return (await db.transactions.toArray()).filter((t) => t.description === 'Browser expense').length
})
console.log('transaction add clicked:', txAdded, '| created:', txCount)

// --- Pomodoro start / pause ---
await page.goto('http://localhost:5173/pomodoro/1', { waitUntil: 'networkidle2' })
await clickText('Start')
await sleep(2400)
const beforePause = await page.evaluate(() => document.querySelector('.timer-text')?.textContent)
await clickText('Pause')
await sleep(300)
const afterPause = await page.evaluate(() => document.querySelector('.timer-text')?.textContent)
await sleep(1200)
const stillPaused = await page.evaluate(() => document.querySelector('.timer-text')?.textContent)
console.log('timer:', beforePause, '-> paused:', afterPause, '-> 1.2s later:', stillPaused)
await page.screenshot({ path: `${OUT}/pomodoro-running.png` })

// --- Dark mode ---
await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle2' })
await clickText('dark')
await sleep(400)
const theme = await page.evaluate(() => document.documentElement.dataset.theme)
await page.screenshot({ path: `${OUT}/settings-dark.png` })
console.log('theme after toggle:', theme)
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
await page.screenshot({ path: `${OUT}/home-dark.png` })

// --- Desktop layout ---
await page.setViewport({ width: 1280, height: 900 })
await page.evaluate(() => {
  localStorage.setItem('clarity.preferences', JSON.stringify({ username: 'CJ', darkMode: false }))
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
await sleep(300)
await page.screenshot({ path: `${OUT}/desktop-home.png` })
await page.goto('http://localhost:5173/budget', { waitUntil: 'networkidle2' })
await sleep(300)
await page.screenshot({ path: `${OUT}/desktop-budget.png` })

// --- Onboarding ---
await page.setViewport({ width: 430, height: 932 })
await page.evaluate(() => localStorage.removeItem('clarity.preferences'))
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
await sleep(300)
await page.screenshot({ path: `${OUT}/onboarding.png` })
const onboard = await page.evaluate(() => document.body.innerText.includes('Welcome to Clarity'))
console.log('onboarding shown:', onboard)

console.log('\nERRORS:', errors.length)
errors.slice(0, 20).forEach((e) => console.log(' -', e))
await browser.close()
