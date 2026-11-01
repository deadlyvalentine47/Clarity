import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const OUT = '/tmp/opencode/clarity-shots'
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
    db.tasks.clear(),
    db.subtasks.clear(),
    db.habits.clear(),
    db.categories.clear(),
    db.sources.clear(),
    db.transactions.clear(),
    db.pomodoroFocusSessions.clear(),
  ])
  await db.tasks.bulkAdd([
    { title: 'Ship the web port', description: 'Parity with Android app', priority: 'High', category: 'Work', tags: [], dueDate: now + 3600_000, reminderTime: null, isCompleted: false, isRecurring: false, recurringType: null, createdAt: now, updatedAt: now },
    { title: 'Buy groceries', description: '', priority: 'Medium', category: 'Home', tags: [], dueDate: now + 86_400_000, reminderTime: null, isCompleted: false, isRecurring: true, recurringType: 'Weekly', createdAt: now, updatedAt: now },
  ])
  await db.habits.bulkAdd([
    { name: 'Drink water', description: '8 glasses', frequency: 'Daily', alternateDays: null, selectedDays: null, targetCount: 1, currentStreak: 0, bestStreak: 2, completionHistory: {}, lateCompletions: [], reminderTime: null, isArchived: false, archivedAt: null, isDeleted: false, deletedAt: null, deadlineHour: null, deadlineMinute: null, dailyNotes: {}, createdAt: now },
  ])
  await db.categories.bulkAdd([{ name: 'Food', isDefault: true, createdAt: now }])
  await db.sources.bulkAdd([{ name: 'Bank Account', isDefault: true, createdAt: now }])
  await db.pomodoroFocusSessions.add({ title: 'Deep work', focusDurationMinutes: 25, breakDurationMinutes: 5, sessionCount: 0, totalFocusMinutes: 0, distractions: '', createdAt: now, updatedAt: now })
})

await page.goto('http://localhost:5173/tasks', { waitUntil: 'networkidle2' })

// --- Add a task through the dialog ---
await page.click('.fab')
await sleep(250)
await page.type('.dialog input', 'Test from browser')
await page.evaluate(() => {
  const area = document.querySelector('.dialog textarea')
  if (area) area.value = ''
})
await page.select('.dialog select', 'High')
const added = await clickText('Add')
await sleep(400)
const taskCount = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  return (await db.tasks.toArray()).filter((t) => t.title === 'Test from browser').length
})
console.log('task dialog opened/add clicked:', added, '| tasks created:', taskCount)

// --- Add a subtask on the first task ---
const expandClicked = await clickText('Add subtask')
await sleep(200)
const subtaskAdded = await page.evaluate(async () => {
  const input = [...document.querySelectorAll('input')].find((i) => i.placeholder === 'Add subtask')
  if (!input) return 'no input'
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, 'Browser subtask')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 100))
  const form = input.closest('form')
  form?.requestSubmit()
  await new Promise((r) => setTimeout(r, 300))
  const { db } = await import('/src/db/db.ts')
  return (await db.subtasks.toArray()).filter((s) => s.title === 'Browser subtask').length
})
console.log('expand clicked:', expandClicked, '| subtask created:', subtaskAdded)

// --- Toggle first task checkbox ---
const toggled = await page.evaluate(() => {
  const cb = document.querySelector('.checkbox')
  if (!cb) return false
  cb.click()
  return true
})
await sleep(300)
console.log('task checkbox clicked:', toggled)

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
await page.type('.dialog input[type="number"]', '12.34')
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
