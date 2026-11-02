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
  const { toggleHabitForDate, computeStreak } = await import('/src/db/habits.ts')
  const {
    eventOccursOn,
    eventOccurrence,
    eventStatus,
    eventFrequencyLabel,
    hasOverdueOccurrence,
    isEventScheduledOn,
    nextEventOccurrence,
    skipEventOccurrence,
    toggleEventCompletion,
  } = await import('/src/db/events.ts')
  const { toDateKey } = await import('/src/lib/dates.ts')
  const { billingCycle, payCardBill, deleteCardCascade, renameSource } = await import('/src/db/budget.ts')
  const { moveNote } = await import('/src/db/notes.ts')
  const { exportData, importData } = await import('/src/lib/exportImport.ts')
  const { loadPreferences } = await import('/src/lib/prefs.ts')

  await Promise.all([
    db.habits.clear(), db.notes.clear(), db.transactions.clear(),
    db.goals.clear(), db.events.clear(),
  ])

  // --- Events: recurrence, due state and completion -----------------------
  const day = (offset, hour = 9) => {
    const d = new Date()
    d.setHours(hour, 0, 0, 0)
    d.setDate(d.getDate() + offset)
    return d
  }
  const eventBase = {
    description: '', category: '', color: '#4A90D9', isAllDay: false,
    reminderTime: null, priority: null, dueDate: null, alternateDays: null,
    selectedDays: null, completionHistory: {}, skippedDates: {}, createdAt: Date.now(),
  }
  const addEvent = (extra) =>
    db.events.add({
      ...eventBase,
      title: 'Event',
      startDate: day(0).getTime(),
      endDate: day(0, 10).getTime(),
      frequency: null,
      ...extra,
    })

  const dailyId = await addEvent({ title: 'Daily', frequency: 'Daily' })
  const weeklyId = await addEvent({ title: 'Weekly', frequency: 'Weekly' })
  const alternateId = await addEvent({ title: 'Alternate', frequency: 'Alternate', alternateDays: 1 })
  const customId = await addEvent({ title: 'Custom', frequency: 'Custom', selectedDays: [1, 3, 5] })
  const monthly31Id = await db.events.add({
    ...eventBase,
    title: 'Monthly 31',
    startDate: new Date(2026, 0, 31, 9).getTime(),
    endDate: new Date(2026, 0, 31, 10).getTime(),
    frequency: 'Monthly',
  })

  const daily = await db.events.get(dailyId)
  const weekly = await db.events.get(weeklyId)
  const alternate = await db.events.get(alternateId)
  const custom = await db.events.get(customId)
  const monthly31 = await db.events.get(monthly31Id)

  const nextWeekday = (iso) => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    while ((d.getDay() === 0 ? 7 : d.getDay()) !== iso) d.setDate(d.getDate() + 1)
    return d
  }

  const recurrence = {
    dailyToday: isEventScheduledOn(daily, day(0)),
    dailyTomorrow: isEventScheduledOn(daily, day(1)),
    dailyBeforeStart: isEventScheduledOn(daily, day(-1)),
    weeklyToday: isEventScheduledOn(weekly, day(0)),
    weeklyTomorrow: isEventScheduledOn(weekly, day(1)),
    weeklyNextWeek: isEventScheduledOn(weekly, day(7)),
    monthlyClampedFeb28: isEventScheduledOn(monthly31, new Date(2026, 1, 28, 12)),
    monthlyFeb27: isEventScheduledOn(monthly31, new Date(2026, 1, 27, 12)),
    alternateEveryTwoDays: isEventScheduledOn(alternate, day(2)),
    alternateSkipsOdd: isEventScheduledOn(alternate, day(1)),
    customMonday: isEventScheduledOn(custom, nextWeekday(1)),
    customTuesday: isEventScheduledOn(custom, nextWeekday(2)),
    label: eventFrequencyLabel(weekly),
  }

  const dueStatus = eventStatus(daily, day(0))
  await toggleEventCompletion(dailyId, day(0), true)
  const doneStatus = eventStatus(await db.events.get(dailyId), day(0))
  await toggleEventCompletion(dailyId, day(0), false)
  const clearedStatus = eventStatus(await db.events.get(dailyId), day(0))

  await skipEventOccurrence(dailyId, day(0))
  const skippedEvent = await db.events.get(dailyId)
  const skipChecks = {
    hiddenToday: !eventOccursOn(skippedEvent, day(0)),
    visibleTomorrow: eventOccursOn(skippedEvent, day(1)),
    skippedKey: skippedEvent.skippedDates?.[toDateKey(day(0))] === true,
    nextIsTomorrow: toDateKey(nextEventOccurrence(skippedEvent, new Date())) === toDateKey(day(1)),
  }

  const pastId = await addEvent({
    title: 'Past one-off',
    startDate: day(-2).getTime(),
    endDate: day(-2, 10).getTime(),
    dueDate: day(-2).getTime(),
  })
  const past = await db.events.get(pastId)
  const occurrence = eventOccurrence(await db.events.get(dailyId), day(0))
  const status = {
    dueStatus,
    doneStatus,
    clearedStatus,
    pastStatus: eventStatus(past, day(-2)),
    pastOverdueFlag: hasOverdueOccurrence(past),
    occurrenceStartHour: new Date(occurrence.start).getHours(),
    occurrenceKeyIsToday: occurrence.key === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
  }

  // --- Habit streak -------------------------------------------------------
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

  // --- Billing cycle ------------------------------------------------------
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

  // --- Card cascade -------------------------------------------------------
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
    cardATxnsLeft: await db.creditCardTransactions.where('cardId').equals(cardA).count(),
    cardBLinkIntact: bBank?.linkedCardTxnId === bTxns[0].id,
    bankBalance,
  }

  // --- Notes --------------------------------------------------------------
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

  // --- Account rename -----------------------------------------------------
  await renameSource(900, 'Logic Bank Renamed')
  const drift = await db.transactions.where('source').equals('Logic Bank').count()

  // --- Export -> clear -> import round trip -------------------------------
  const roundTripId = await addEvent({
    title: 'Round trip event',
    priority: 'High',
    dueDate: day(0).getTime(),
    frequency: 'Weekly',
  })
  await toggleEventCompletion(roundTripId, day(0), true)
  const json = await exportData(loadPreferences())
  const parsed = JSON.parse(json)
  await db.habits.clear(); await db.notes.clear(); await db.events.clear()
  await importData(json)
  const restoredEvents = await db.events.toArray()
  const roundTripEvent = restoredEvents.find((e) => e.title === 'Round trip event')
  const todayKey = key(new Date())

  return {
    recurrence,
    status,
    skipChecks,
    frequencyLabel: eventFrequencyLabel(weekly),
    streakBefore,
    streakAfterUncheck: afterUncheck.currentStreak,
    bestStreak: afterUncheck.bestStreak,
    exportShape: Object.keys(parsed).sort(),
    exportHasTasks: 'tasks' in parsed || 'subtasks' in parsed,
    restoredEvent: roundTripEvent
      ? {
          priority: roundTripEvent.priority,
          frequency: roundTripEvent.frequency,
          completed: roundTripEvent.completionHistory[todayKey] === true,
        }
      : null,
    billing,
    cascade,
    notes,
    renamedTxnsStillLinked: drift === 0,
  }
})

console.log(JSON.stringify(result, null, 2))
console.log('page errors:', errors)
await browser.close()
