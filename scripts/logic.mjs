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
  const {
    acceptFix,
    distanceLabel,
    formatClock,
    formatPace,
    haversineMeters,
    splitSeconds,
  } = await import('/src/lib/geo.ts')

  await Promise.all([
    db.habits.clear(), db.notes.clear(), db.transactions.clear(),
    db.goals.clear(), db.events.clear(), db.runs.clear(),
    db.runGroups.clear(),
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

  // --- Habit order: grouped habits flatten group by group ------------------
  // Per-group sortOrder values collide, so the home strip must flatten the
  // same top-level rows as the Habits screen instead of a flat sort.
  const { buildTopLevelRows } = await import('/src/db/habitGroups.ts')
  const mkHabit = (id, sortOrder, groupId, createdAt) => ({
    id, name: `h${id}`, sortOrder, groupId, createdAt,
  })
  const habitOrder = buildTopLevelRows(
    [
      mkHabit(1, 10, 1, 10),
      mkHabit(2, 20, 1, 11),
      mkHabit(3, 10, 2, 12),
      mkHabit(4, 20, 2, 13),
      mkHabit(5, 30, null, 14),
    ],
    [
      { id: 1, name: 'A', sortOrder: 10, createdAt: 1 },
      { id: 2, name: 'B', sortOrder: 20, createdAt: 2 },
    ],
  )
    .flatMap((row) => (row.kind === 'group' ? row.habits : [row.habit]))
    .map((h) => h.id)

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
  // `now` is a Date and `day` is the recurrence helper above, so a naive
  // `now - day` is NaN. Use explicit epoch milliseconds for the fixture.
  const runStart = now.getTime() - 86_400_000
  const logicRunId = await db.runs.add({
    startedAt: runStart,
    endedAt: runStart + 600_000,
    durationSeconds: 600,
    distanceMeters: 1234.5,
    isManualDistance: false,
    notes: 'round trip',
    createdAt: now.getTime(),
  })
  await db.runTracks.put({
    runId: logicRunId,
    points: [
      { t: runStart, lat: 1, lng: 1, acc: 5, alt: null, spd: 2.8 },
      { t: runStart + 600_000, lat: 1.009, lng: 1, acc: 5, alt: null, spd: 2.8 },
    ],
  })

  // --- Run sessions: order, timeline and manual override -------------------
  // Default order is start time (newest first); a session reads as a timeline.
  const { buildRunRows, createRunGroup, deleteRunGroup, moveRunToGroup, moveTopLevelRunByOffset, removeRunFromGroup } = await import('/src/db/runGroups.ts')
  const runBase = {
    endedAt: null, durationSeconds: 300, isManualDistance: false,
    notes: '', groupId: null, sortOrder: null,
  }
  const stamp = (h, m) => {
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d.getTime()
  }
  const walkA = await db.runs.add({ ...runBase, name: 'Walk A', distanceMeters: 1000, startedAt: stamp(7, 0), createdAt: stamp(7, 10) })
  const runB = await db.runs.add({ ...runBase, name: 'Run B', distanceMeters: 5000, startedAt: stamp(7, 30), createdAt: stamp(7, 40) })
  const walkC = await db.runs.add({ ...runBase, name: 'Walk C', distanceMeters: 1200, startedAt: stamp(8, 0), createdAt: stamp(8, 10) })
  const earlyRun = await db.runs.add({
    ...runBase, name: 'Early run', distanceMeters: 800, startedAt: stamp(6, 0), createdAt: stamp(6, 10),
  })
  const runGroupId = await createRunGroup('Morning walk-run', [walkA, runB, walkC])
  let groupRows = buildRunRows(await db.runs.toArray(), await db.runGroups.toArray())
  const sessionRow = groupRows.find((row) => row.kind === 'group')
  const session = {
    name: sessionRow?.group.name ?? null,
    timeline: sessionRow?.kind === 'group' ? sessionRow.runs.map((r) => r.startedAt) : [],
    timelineAscending: sessionRow?.kind === 'group'
      ? sessionRow.runs.every((r, i, arr) => i === 0 || arr[i - 1].startedAt <= r.startedAt)
      : false,
  }
  // Manual position must beat the created-date default after a move.
  const groupItem = { kind: 'group', id: runGroupId }
  const beforeIndex = groupRows.findIndex((row) => row.kind === 'group')
  await moveTopLevelRunByOffset(groupItem, 1)
  groupRows = buildRunRows(await db.runs.toArray(), await db.runGroups.toArray())
  const afterIndex = groupRows.findIndex((row) => row.kind === 'group')
  const sessionOrder = {
    beforeIndex,
    afterIndex,
    movedDownOne: afterIndex === beforeIndex + 1,
    manualWinsOverDate: afterIndex !== beforeIndex,
  }
  // Drop a run before a sibling, then take it out of the session again.
  await moveRunToGroup(walkC, runGroupId, { targetRunId: walkA, position: 'before' })
  const membersAfterDrop = (buildRunRows(await db.runs.toArray(), await db.runGroups.toArray())
    .find((row) => row.kind === 'group')?.runs ?? []).map((run) => run.name)
  await removeRunFromGroup(walkC)
  const afterRemove = buildRunRows(await db.runs.toArray(), await db.runGroups.toArray())
  const sessionEdit = {
    membersAfterDrop,
    droppedBeforeTarget: membersAfterDrop[0] === 'Walk C',
    afterRemoveGrouped: afterRemove.find((row) => row.kind === 'group')?.runs.length ?? 0,
    afterRemoveTopLevel: afterRemove.some((row) => row.kind === 'run' && row.run.name === 'Walk C'),
  }
  await moveRunToGroup(walkC, runGroupId, { position: 'after' })
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
  const restoredRuns = await db.runs.toArray()
  const roundTripRun = restoredRuns.find((run) => run.notes === 'round trip')
  const restoredTrack = roundTripRun?.id != null ? await db.runTracks.get(roundTripRun.id) : null
  const restoredGroupedRuns = restoredRuns.filter((run) => run.groupId != null).length
  const restoredGroupCount = await db.runGroups.count()
  const restoredGroup = (await db.runGroups.toArray())[0]
  if (restoredGroup?.id != null) await deleteRunGroup(restoredGroup.id)
  const afterGroupDelete = {
    groups: await db.runGroups.count(),
    ungroupedRuns: (await db.runs.toArray()).filter((run) => run.groupId == null).length,
    runsKept: await db.runs.count(),
  }
  const todayKey = key(new Date())

  // --- Runs: distance filtering + split math ------------------------------
  const firstFix = acceptFix(null, { t: 0, lat: 0, lng: 0, acc: 5 })
  const filter = {
    accuracyRejected: acceptFix(null, { t: 0, lat: 0, lng: 0, acc: 40 }).reason,
    firstAccepted: firstFix.accepted,
    jitterReason: acceptFix(
      { t: 0, lat: 0, lng: 0, acc: 5 },
      { t: 10_000, lat: 0.000001, lng: 0, acc: 5 },
    ).reason,
    speedReason: acceptFix(
      { t: 0, lat: 0, lng: 0, acc: 5 },
      { t: 1000, lat: 0.01, lng: 0, acc: 5 },
    ).reason,
    okAccepted: acceptFix(
      { t: 0, lat: 0, lng: 0, acc: 5 },
      { t: 300_000, lat: 0.009, lng: 0, acc: 5 },
    ).accepted,
  }
  const splits = splitSeconds([
    { t: 0, lat: 0, lng: 0, acc: 5 },
    { t: 150_000, lat: 0.0045, lng: 0, acc: 5 },
    { t: 300_000, lat: 0.009, lng: 0, acc: 5 },
    { t: 450_000, lat: 0.0135, lng: 0, acc: 5 },
  ])
  const geo = {
    oneDegreeLatMeters: Math.round(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })),
    ...filter,
    splitCount: splits.length,
    firstSplitSeconds: splits[0]?.seconds ?? null,
    clockUnderHour: formatClock(2539),
    clockOverHour: formatClock(3764),
    pace: formatPace(300, 1000, 'km'),
    mileLabel: distanceLabel(1609.344, 'mi'),
  }

  // --- Regression checks for the v2 fixes --------------------------------
  const { completeHabitLate, markMissedDays } = await import('/src/db/habits.ts')
  const { summarizeBudget } = await import('/src/db/budget.ts')
  const { deleteRun } = await import('/src/db/runGroups.ts')

  // L9: a weekly 22:00 -> 02:00 series keeps its 4 h span and overlaps the
  // following day while completion/skip stay on the anchor (start) day.
  const overnightId = await addEvent({
    title: 'Overnight weekly',
    frequency: 'Weekly',
    startDate: day(-1, 22).getTime(),
    endDate: day(0, 2).getTime(),
  })
  let overnight = await db.events.get(overnightId)
  const overnightOccurrence = eventOccurrence(overnight, day(0, 12))
  const overnightSpansNextDay = eventOccursOn(overnight, day(0, 12))
  const overnightKeyIsAnchor = overnightOccurrence.key === key(day(-1))
  const overnightDurationHours = (overnightOccurrence.end - overnightOccurrence.start) / 3_600_000
  await skipEventOccurrence(overnightId, day(0, 12))
  overnight = await db.events.get(overnightId)
  const overnightSkipHidesBothDays =
    !eventOccursOn(overnight, day(0, 12)) && !eventOccursOn(overnight, day(-1, 12))
  const overnightCheck = {
    spansNextDay: overnightSpansNextDay,
    keyIsAnchor: overnightKeyIsAnchor,
    durationHours: overnightDurationHours,
    skipHidesBothDays: overnightSkipHidesBothDays,
  }

  // L2: a past "Done" is on time; only an explicit Done late gets the flag.
  const habitBase = {
    description: '', frequency: 'Daily', alternateDays: null, selectedDays: null,
    targetCount: 1, currentStreak: 0, bestStreak: 0, completionHistory: {},
    lateCompletions: [], reminderTime: null, isArchived: false, archivedAt: null,
    isDeleted: false, deletedAt: null, dailyNotes: {},
  }
  const lateHabitId = await db.habits.add({
    ...habitBase,
    name: 'Deadline habit',
    deadlineHour: 9,
    deadlineMinute: 0,
    createdAt: day(-10).getTime(),
  })
  await toggleHabitForDate(lateHabitId, key(day(-2)), true)
  await completeHabitLate(lateHabitId, key(day(-3)))
  const lateHabit = await db.habits.get(lateHabitId)
  const doneVsLate = {
    pastDoneIsOnTime: !lateHabit.lateCompletions.includes(key(day(-2))),
    explicitLateIsLate: lateHabit.lateCompletions.includes(key(day(-3))),
  }

  // L1: backfill fills the recent window, not the first two years.
  const oldHabitId = await db.habits.add({
    ...habitBase,
    name: 'Old habit',
    createdAt: day(-1000).getTime(),
  })
  await markMissedDays(oldHabitId)
  const oldHabit = await db.habits.get(oldHabitId)
  const oldHistory = oldHabit.completionHistory
  const backfill = {
    yesterdayFilled: oldHistory[key(day(-1))] === false,
    insideWindowFilled: oldHistory[key(day(-700))] === false,
    outsideWindowUntouched: !(key(day(-800)) in oldHistory),
    creationDayUntouched: !(key(day(-1000)) in oldHistory),
  }

  // L5: card credit offsets debt across cards, and net worth keeps the credit.
  const budgetNet = summarizeBudget({
    sources: [{ id: 1, name: 'Bank', balance: 1000, isDefault: false, createdAt: 0 }],
    cardTxns: [
      { id: 1, cardId: 1, type: 'Purchase', amount: 500, description: '', date: 0, createdAt: 0 },
      { id: 2, cardId: 2, type: 'Payment', amount: 300, description: '', date: 0, createdAt: 0 },
    ],
  })
  const budgetCredit = summarizeBudget({
    sources: [],
    cardTxns: [
      { id: 3, cardId: 1, type: 'Purchase', amount: 100, description: '', date: 0, createdAt: 0 },
      { id: 4, cardId: 2, type: 'Payment', amount: 400, description: '', date: 0, createdAt: 0 },
    ],
  })
  const budgetTotals = {
    nettedDebt: budgetNet.cardDebt,
    nettedWorth: budgetNet.netWorth,
    creditShown: budgetCredit.cardCredit,
    noNegativeDebt: budgetCredit.cardDebt === 0,
    creditInWorth: budgetCredit.netWorth === 300,
  }

  // L10: deleting a run removes its track and prunes an emptied session.
  const delA = await db.runs.add({ ...runBase, name: 'Delete A', distanceMeters: 10, startedAt: stamp(4, 0), createdAt: stamp(4, 1) })
  const delB = await db.runs.add({ ...runBase, name: 'Delete B', distanceMeters: 10, startedAt: stamp(4, 30), createdAt: stamp(4, 31) })
  const delGroup = await createRunGroup('Delete session', [delA, delB])
  await db.runTracks.put({ runId: delA, points: [{ t: 1, lat: 1, lng: 1, acc: 5 }] })
  await deleteRun(delA)
  const groupAfterFirstDelete = await db.runGroups.get(delGroup)
  const trackAfterDelete = await db.runTracks.get(delA)
  await deleteRun(delB)
  const groupAfterLastDelete = await db.runGroups.get(delGroup)
  const deleteRunCheck = {
    groupKeptWhileNotEmpty: groupAfterFirstDelete != null,
    trackRemoved: trackAfterDelete == null,
    emptyGroupPruned: groupAfterLastDelete == null,
  }

  // L11: grouping runs that are all nested keeps the container's position.
  const nestA = await db.runs.add({ ...runBase, name: 'Nest A', distanceMeters: 10, startedAt: stamp(5, 0), createdAt: stamp(5, 1) })
  const nestB = await db.runs.add({ ...runBase, name: 'Nest B', distanceMeters: 10, startedAt: stamp(5, 30), createdAt: stamp(5, 31) })
  const outerGroup = await createRunGroup('Outer session', [nestA, nestB])
  await db.runs.add({ ...runBase, name: 'Solo top', distanceMeters: 10, startedAt: stamp(9, 0), createdAt: stamp(9, 1) })
  const rowsBeforeNest = buildRunRows(await db.runs.toArray(), await db.runGroups.toArray())
  const outerIndexBefore = rowsBeforeNest.findIndex((row) => row.kind === 'group' && row.group.id === outerGroup)
  const innerGroup = await createRunGroup('Inner session', [nestA, nestB])
  const rowsAfterNest = buildRunRows(await db.runs.toArray(), await db.runGroups.toArray())
  const innerIndexAfter = rowsAfterNest.findIndex((row) => row.kind === 'group' && row.group.id === innerGroup)
  const nestedGrouping = {
    outerIndexBefore,
    innerIndexAfter,
    insertedAtContainer: innerIndexAfter === outerIndexBefore && outerIndexBefore > 0,
  }

  return {
    recurrence,
    status,
    skipChecks,
    frequencyLabel: eventFrequencyLabel(weekly),
    streakBefore,
    streakAfterUncheck: afterUncheck.currentStreak,
    bestStreak: afterUncheck.bestStreak,
    habitOrder,
    exportShape: Object.keys(parsed).sort(),
    exportHasTasks: 'tasks' in parsed || 'subtasks' in parsed,
    geo,
    runsRoundTrip: {
      exported: Array.isArray(parsed.runs) && parsed.runs.length === 5,
      restored: restoredRuns.length,
      distance: roundTripRun?.distanceMeters ?? null,
      points: restoredTrack?.points.length ?? 0,
      rowsCarryPoints: restoredRuns.some((run) => Array.isArray(run.points)),
      exportedPoints: parsed.runs.find((r) => r.notes === 'round trip')?.points?.length ?? 0,
    },
    runsSession: session,
    runsSessionOrder: sessionOrder,
    runsSessionEdit: sessionEdit,
    overnightCheck,
    doneVsLate,
    backfill,
    budgetTotals,
    deleteRunCheck,
    nestedGrouping,
    runsSessionRoundTrip: {
      groupsExported: Array.isArray(parsed.runGroups) && parsed.runGroups.length === 1,
      groupsRestored: restoredGroupCount,
      groupedRuns: restoredGroupedRuns,
      afterDelete: afterGroupDelete,
    },
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
