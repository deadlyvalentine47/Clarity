import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: process.env.BRAVE_PATH || '/usr/bin/brave',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })

const result = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts')
  const { toggleTaskCompletion, newTask } = await import('/src/db/tasks.ts')
  const { toggleHabitForDate, computeStreak } = await import('/src/db/habits.ts')
  const { billingCycle, payCardBill, deleteCardCascade, renameSource } = await import('/src/db/budget.ts')
  const { moveNote, flattenTree } = await import('/src/db/notes.ts')
  const { exportData, importData } = await import('/src/lib/exportImport.ts')
  const { loadPreferences } = await import('/src/lib/prefs.ts')

  await Promise.all([
    db.tasks.clear(), db.subtasks.clear(), db.habits.clear(), db.notes.clear(),
    db.transactions.clear(), db.goals.clear(), db.events.clear(),
  ])

  // Recurring task: completing it should create the next occurrence.
  const due = new Date(2026, 0, 10, 12).getTime()
  const id = await db.tasks.add(newTask({ title: 'Daily standup', dueDate: due, isRecurring: true, recurringType: 'Daily' }))
  await toggleTaskCompletion(id, true)
  const tasks = await db.tasks.toArray()
  const spawned = tasks.find((t) => !t.isCompleted)
  const nextDate = spawned?.dueDate ? new Date(spawned.dueDate) : null

  // Habit streak: today + yesterday + day before = 3.
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const now = new Date()
  const y = new Date(now); y.setDate(y.getDate() - 1)
  const yy = new Date(now); yy.setDate(yy.getDate() - 2)
  const hid = await db.habits.add({
    name: 'Test habit', description: '', frequency: 'Daily', alternateDays: null, selectedDays: null, targetCount: 1,
    currentStreak: 0, bestStreak: 0,
    completionHistory: { [key(now)]: true, [key(y)]: true, [key(yy)]: true },
    lateCompletions: [], reminderTime: null, isArchived: false, archivedAt: null,
    isDeleted: false, deletedAt: null, deadlineHour: null, deadlineMinute: null,
    dailyNotes: {}, createdAt: Date.now() - 3 * 86_400_000,
  })
  const streakBefore = computeStreak(await db.habits.get(hid))
  await toggleHabitForDate(hid, key(now), false)
  const afterUncheck = await db.habits.get(hid)

  // Billing cycle clamps day 31 in February and labels the previous window.
  const feb = billingCycle(2026, 2, 31)
  const febStart = new Date(feb.start)
  const febEnd = new Date(feb.end)
  const billing = {
    startDay: febStart.getDate(),
    startMonth: febStart.getMonth() + 1,
    endDay: febEnd.getDate(),
    endMonth: febEnd.getMonth() + 1,
    startLabel: feb.startLabel,
    endLabel: feb.endLabel,
  }

  // Two cards, each with a bill paid from the same account. Deleting one card
  // must leave the other card's bank link untouched.
  const cardA = await db.creditCards.add({ name: 'Card A', creditLimit: 10000, billingCycleDay: 5, createdAt: Date.now() })
  const cardB = await db.creditCards.add({ name: 'Card B', creditLimit: 20000, billingCycleDay: 20, createdAt: Date.now() })
  await db.sources.put({ id: 900, name: 'Logic Bank', balance: 5000, isDefault: false, createdAt: Date.now() })
  await payCardBill({ cardId: cardA, amount: 100, source: 'Logic Bank', description: 'A bill' })
  await payCardBill({ cardId: cardB, amount: 200, source: 'Logic Bank', description: 'B bill' })
  await deleteCardCascade(cardA)
  const bTxns = await db.creditCardTransactions.where('cardId').equals(cardB).toArray()
  const bBank = await db.transactions.get(bTxns[0].linkedTransactionId)
  const bankBalance = (await db.sources.get(900)).balance
  const cascade = {
    cardAStillThere: !!(await db.creditCards.get(cardA)),
    cardATxnsLeft: (await db.creditCardTransactions.where('cardId').equals(cardA).count()),
    cardBLinkIntact: bBank?.linkedCardTxnId === bTxns[0].id,
    bankBalance,
  }

  // Note tree: moving a parent inside its own child must throw, and reorder
  // must renumber siblings.
  const root = await db.notes.add({ title: 'Root', content: '', isPinned: false, category: '', parentNoteId: null, sortOrder: 10, createdAt: Date.now(), updatedAt: Date.now() })
  const childId = await db.notes.add({ title: 'Child', content: '', isPinned: false, category: '', parentNoteId: root, sortOrder: 10, createdAt: Date.now(), updatedAt: Date.now() })
  let cycleBlocked = false
  try {
    await moveNote(root, childId, 'inside')
  } catch {
    cycleBlocked = true
  }
  const second = await db.notes.add({ title: 'Second', content: '', isPinned: false, category: '', parentNoteId: null, sortOrder: 20, createdAt: Date.now(), updatedAt: Date.now() })
  await moveNote(second, root, 'above')
  const topLevel = (await db.notes.toArray()).filter((n) => n.parentNoteId == null).sort((a, b) => a.sortOrder - b.sortOrder)
  const notes = {
    cycleBlocked,
    order: topLevel.map((n) => n.title),
    ordersUnique: new Set(topLevel.map((n) => n.sortOrder)).size === topLevel.length,
  }

  // Renaming an account keeps its transactions attached (no name drift).
  await renameSource(900, 'Logic Bank Renamed')
  const drift = await db.transactions.where('source').equals('Logic Bank').count()

  // Export -> clear -> import round trip.
  await db.notes.add({ title: 'Round trip', content: 'body', isPinned: true, category: 'Test', createdAt: Date.now(), updatedAt: Date.now() })
  const json = await exportData(loadPreferences())
  const parsed = JSON.parse(json)
  await db.tasks.clear(); await db.habits.clear(); await db.notes.clear()
  await importData(json)
  const restoredNotes = await db.notes.toArray()
  const roundTripNote = restoredNotes.find((n) => n.title === 'Round trip')
  const restoredTasks = await db.tasks.count()

  return {
    recurringSpawned: !!spawned,
    nextDateIsNextDay: nextDate?.getDate() === 11 && nextDate?.getMonth() === 0,
    streakBefore,
    streakAfterUncheck: afterUncheck.currentStreak,
    bestStreak: afterUncheck.bestStreak,
    exportShape: Object.keys(parsed).sort(),
    restoredNotes: restoredNotes.length,
    restoredNotePinned: roundTripNote?.isPinned === true,
    restoredTasks,
    billing,
    cascade,
    notes,
    renamedTxnsStillLinked: drift === 0,
  }
})

console.log(JSON.stringify(result, null, 2))
console.log('page errors:', errors)
await browser.close()
