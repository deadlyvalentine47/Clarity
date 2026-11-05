// Seeds the demo run fixtures through the app's own Dexie module and captures
// a screenshot of each run's detail screen. Requires the Vite dev server
// (npm run dev, port 5173) because the fixtures live in src/lib/demoRuns.ts.
//
//   npm run scenarios
//   SCENARIO_SHOTS=/some/dir npm run scenarios
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.SCENARIOS_BASE || 'http://localhost:5173'
const OUT = process.env.SCENARIO_SHOTS || join(tmpdir(), 'clarity-scenarios')
fs.mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: process.env.BRAVE_PATH || '/usr/bin/brave',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
})

const page = await browser.newPage()
await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 })

const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`)
})
page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`))

await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
await page.evaluate(() => {
  const raw = localStorage.getItem('clarity.preferences')
  const prefs = raw ? JSON.parse(raw) : { username: 'CJ', darkMode: false }
  localStorage.setItem('clarity.preferences', JSON.stringify({ ...prefs, onboarded: true }))
})

const seeded = await page.evaluate(async () => {
  const module = await import('/src/lib/demoRuns.ts')
  const result = await module.seedDemoRuns()
  const { db } = await import('/src/db/db.ts')
  const runs = await db.runs.orderBy('startedAt').reverse().toArray()
  return {
    result,
    runs: runs
      .filter((run) => run.notes.startsWith('Demo · '))
      .map((run) => ({ id: run.id, notes: run.notes, distance: run.distanceMeters })),
  }
})

console.log('seeded', seeded.result)

const slug = (text) =>
  text
    .replace('Demo · ', '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const rows = []
for (const run of seeded.runs) {
  await page.goto(`${BASE}/runs/${run.id}`, { waitUntil: 'networkidle2' })
  // Vite may still be optimising dependencies on the first navigation, so wait
  // for the detail screen itself rather than a fixed delay.
  await page
    .waitForFunction(
      () => Boolean(document.querySelector('.page-title, .content-detail .card')),
      { timeout: 15000 },
    )
    .catch(() => {})
  await new Promise((resolve) => setTimeout(resolve, 600))

  const info = await page.evaluate(() => {
    const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? null
    const stats =
      [...document.querySelectorAll('p')].find((p) => /gain \+/.test(p.textContent ?? ''))
        ?.textContent?.replace(/\s+/g, ' ')
        .trim() ?? null
    const exaggeration = [...document.querySelectorAll('.route-3d-tools .segmented')]
      .map((group) => ({
        label: group.getAttribute('aria-label'),
        active: [...group.querySelectorAll('button')].find((b) => b.className === 'active')
          ?.textContent,
      }))
      .find((entry) => entry.label === 'Height exaggeration')

    return {
      heading: text('.page-title') ?? text('h1'),
      subtitle: [...document.querySelectorAll('p')].find((p) => /km|mi/.test(p.textContent ?? ''))
        ?.textContent?.trim(),
      mode3d: Boolean(document.querySelector('.route-map-3d svg')),
      segments: document.querySelectorAll('.route-map-3d polyline.route-seg').length,
      profile: Boolean(document.querySelector('.elevation-profile')),
      stats,
      exaggeration: exaggeration?.active ?? null,
    }
  })

  const file = join(OUT, `${slug(run.notes)}.png`)
  await page.screenshot({ path: file, fullPage: true })
  rows.push({ ...run, ...info, file })
}

await page.goto(`${BASE}/runs`, { waitUntil: 'networkidle2' })
await new Promise((resolve) => setTimeout(resolve, 500))
const listShot = join(OUT, 'runs-list.png')
await page.screenshot({ path: listShot, fullPage: true })

console.table(
  rows.map((row) => ({
    scenario: row.notes.replace('Demo · ', ''),
    distance: `${(row.distance / 1000).toFixed(2)} km`,
    '3d': row.mode3d ? 'yes' : 'no',
    'x': row.exaggeration ?? '—',
    profile: row.profile ? 'yes' : 'no',
    segments: row.segments,
  })),
)

for (const row of rows) {
  console.log(`${row.notes.replace('Demo · ', '')}: ${row.stats ?? 'no elevation data'}`)
}
console.log(`\nlist: ${listShot}`)
console.log(`shots: ${OUT}`)
console.log(errors.length > 0 ? `ERRORS: ${errors.join(' | ')}` : 'ERRORS: 0')

await browser.close()
process.exit(errors.length > 0 ? 1 : 0)
