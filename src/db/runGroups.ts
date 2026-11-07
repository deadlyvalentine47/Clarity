import { db } from './db'
import type { RunGroup, RunSession } from './types'

export type RunItem = { kind: 'run'; id: number } | { kind: 'group'; id: number }
export type DropPos = 'before' | 'after'

export type RunRow =
  | { kind: 'group'; group: RunGroup; runs: RunSession[] }
  | { kind: 'run'; run: RunSession }

interface Ordered {
  sortOrder?: number | null
  startedAt: number
  id?: number
}

const explicit = (value: number | null | undefined): value is number => typeof value === 'number'

/**
 * History order: a manual position always wins; rows that were never moved
 * fall back to start time, newest first. Ungrouped/new rows sort ahead of the
 * positioned ones, so a freshly saved run lands at the top even after the list
 * has been rearranged by hand.
 */
export function compareRunOrder(a: Ordered, b: Ordered): number {
  const ao = a.sortOrder ?? null
  const bo = b.sortOrder ?? null
  if (explicit(ao) && explicit(bo)) {
    if (ao !== bo) return ao - bo
    return b.startedAt - a.startedAt
  }
  if (!explicit(ao) && !explicit(bo)) {
    return b.startedAt - a.startedAt || (a.id ?? 0) - (b.id ?? 0)
  }
  return explicit(ao) ? 1 : -1
}

/** Inside a session the runs read as a timeline: earliest first. */
export function compareRunTimeline(a: Ordered, b: Ordered): number {
  const ao = a.sortOrder ?? null
  const bo = b.sortOrder ?? null
  if (explicit(ao) && explicit(bo)) {
    if (ao !== bo) return ao - bo
    return a.startedAt - b.startedAt
  }
  if (!explicit(ao) && !explicit(bo)) {
    return a.startedAt - b.startedAt || (a.id ?? 0) - (b.id ?? 0)
  }
  return explicit(ao) ? -1 : 1
}

/** A group sits where its newest run sits (or where it was created when empty). */
export function groupStartedAt(group: RunGroup, runs: RunSession[]): number {
  if (runs.length === 0) return group.createdAt
  return Math.max(...runs.map((run) => run.startedAt))
}

function compareTopEntries(a: RunRow, b: RunRow): number {
  const entry = (row: RunRow): Ordered =>
    row.kind === 'group'
      ? { sortOrder: row.group.sortOrder, startedAt: groupStartedAt(row.group, row.runs), id: row.group.id }
      : { sortOrder: row.run.sortOrder, startedAt: row.run.startedAt, id: row.run.id }
  return compareRunOrder(entry(a), entry(b))
}

function bucketRuns(runs: RunSession[], groups: RunGroup[]): Map<number, RunSession[]> {
  const buckets = new Map<number, RunSession[]>()
  for (const group of groups) if (group.id != null) buckets.set(group.id, [])
  const valid = new Set(groups.map((group) => group.id))
  for (const run of runs) {
    if (run.groupId == null || !valid.has(run.groupId)) continue
    buckets.get(run.groupId)?.push(run)
  }
  for (const bucket of buckets.values()) bucket.sort(compareRunTimeline)
  return buckets
}

/**
 * The Runs history list: groups and ungrouped runs interleaved by their manual
 * position, or by start time while the user has never dragged anything.
 * Runs pointing at a missing group fall back to ungrouped.
 */
export function buildRunRows(runs: RunSession[], groups: RunGroup[]): RunRow[] {
  const buckets = bucketRuns(runs, groups)
  const valid = new Set(groups.map((group) => group.id))
  const ungrouped = runs
    .filter((run) => run.groupId == null || !valid.has(run.groupId))
    .sort(compareRunOrder)
  const rows: RunRow[] = [
    ...groups.map((group) => ({ kind: 'group' as const, group, runs: buckets.get(group.id!) ?? [] })),
    ...ungrouped.map((run) => ({ kind: 'run' as const, run })),
  ]
  return rows.sort(compareTopEntries)
}

/** Highest manual position in use, or null when nothing has been moved yet. */
function topSortOrders(rows: RunRow[]): number[] {
  return rows
    .map((row) => (row.kind === 'group' ? row.group.sortOrder : row.run.sortOrder))
    .filter(explicit)
}

/**
 * Position for a newly saved run. Keeps the created-date default (null) until
 * the list has been rearranged; afterwards the new run goes on top.
 */
export async function nextRunSortOrder(): Promise<number | null> {
  const [runs, groups] = await Promise.all([db.runs.toArray(), db.runGroups.toArray()])
  const orders = topSortOrders(buildRunRows(runs, groups))
  if (orders.length === 0) return null
  return Math.min(...orders) - 10
}

/** Rewrite the whole history order, pulling any top-level run out of its group. */
async function renumberTop(rows: RunRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const sortOrder = (i + 1) * 10
    if (row.kind === 'group') {
      if (row.group.id != null) await db.runGroups.update(row.group.id, { sortOrder })
      continue
    }
    if (row.run.id == null) continue
    const patch: Partial<RunSession> = { sortOrder }
    if (row.run.groupId != null) patch.groupId = null
    await db.runs.update(row.run.id, patch)
  }
}

/** Remove groups that lost all their members (they can only be created from runs). */
async function pruneEmptyGroups(except?: number): Promise<void> {
  const [runs, groups] = await Promise.all([db.runs.toArray(), db.runGroups.toArray()])
  const used = new Set(runs.map((run) => run.groupId).filter(explicit))
  for (const group of groups) {
    if (group.id == null || group.id === except) continue
    if (!used.has(group.id)) await db.runGroups.delete(group.id)
  }
}

async function readAll(): Promise<{ runs: RunSession[]; groups: RunGroup[] }> {
  const [runs, groups] = await Promise.all([db.runs.toArray(), db.runGroups.toArray()])
  return { runs, groups }
}

/**
 * Create a session from runs that are already in history and put it exactly
 * where its first (newest) run used to be.
 */
export async function createRunGroup(name: string, runIds: number[]): Promise<number> {
  const trimmed = name.trim() || 'Session'
  if (runIds.length === 0) throw new Error('Select at least one run')

  return db.transaction('rw', db.runs, db.runGroups, async () => {
    const { runs, groups } = await readAll()
    const ids = new Set(runIds)
    const members = runs.filter((run) => run.id != null && ids.has(run.id))
    if (members.length === 0) throw new Error('Select at least one run')

    const group: RunGroup = {
      name: trimmed,
      sortOrder: null,
      isCollapsed: false,
      createdAt: Date.now(),
    }
    const groupId = (await db.runGroups.add(group)) as number
    group.id = groupId

    const rows = buildRunRows(runs, groups)
    let insertAt = rows.findIndex((row) => row.kind === 'run' && ids.has(row.run.id!))
    if (insertAt < 0) {
      // Every selected run was nested inside another session: take that
      // session's place instead of jumping to the top of the list.
      const nested = members.find((run) => run.groupId != null)
      const container = nested
        ? rows.findIndex((row) => row.kind === 'group' && row.group.id === nested.groupId)
        : -1
      insertAt = container >= 0 ? container : 0
    }
    const remaining = rows.filter((row) => !(row.kind === 'run' && ids.has(row.run.id!)))
    remaining.splice(Math.min(insertAt, remaining.length), 0, { kind: 'group', group, runs: [] })

    for (const run of members) {
      await db.runs.update(run.id!, { groupId, sortOrder: null })
    }
    await renumberTop(remaining)
    await pruneEmptyGroups(groupId)
    return groupId
  })
}

export async function setRunGroupCollapsed(groupId: number, collapsed: boolean): Promise<void> {
  await db.runGroups.update(groupId, { isCollapsed: collapsed })
}

export async function renameRunGroup(groupId: number, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  await db.runGroups.update(groupId, { name: trimmed })
}

/** Delete a session; its runs stay in history in their timeline order. */
export async function deleteRunGroup(groupId: number): Promise<void> {
  await db.transaction('rw', db.runs, db.runGroups, async () => {
    const { runs, groups } = await readAll()
    const rows = buildRunRows(runs, groups)
    const index = rows.findIndex((row) => row.kind === 'group' && row.group.id === groupId)
    if (index < 0) return
    const members = rows[index].kind === 'group' ? rows[index].runs : []
    const remaining = rows.filter((_, i) => i !== index)
    remaining.splice(
      Math.min(index, remaining.length),
      0,
      ...members.map((run) => ({ kind: 'run' as const, run })),
    )
    for (const run of members) {
      if (run.id != null) await db.runs.update(run.id, { groupId: null })
    }
    await renumberTop(remaining)
    await db.runGroups.delete(groupId)
  })
}

/** Move a run into a session (or reorder it inside the same one). */
export async function moveRunToGroup(
  runId: number,
  groupId: number,
  options: { targetRunId?: number | null; position?: DropPos } = {},
): Promise<void> {
  const { targetRunId = null, position = 'after' } = options
  await db.transaction('rw', db.runs, db.runGroups, async () => {
    const group = await db.runGroups.get(groupId)
    const run = await db.runs.get(runId)
    if (!group || !run) return

    const previousGroupId = run.groupId ?? null
    const members = (await db.runs.toArray())
      .filter((item) => item.id !== runId && item.groupId === groupId)
      .sort(compareRunTimeline)

    let insertAt = members.length
    if (targetRunId != null) {
      const index = members.findIndex((item) => item.id === targetRunId)
      if (index >= 0) insertAt = position === 'before' ? index : index + 1
    }
    members.splice(insertAt, 0, run)

    for (let i = 0; i < members.length; i += 1) {
      const member = members[i]
      if (member.id == null) continue
      await db.runs.update(member.id, { groupId, sortOrder: (i + 1) * 10 })
    }
    if (group.isCollapsed) await db.runGroups.update(groupId, { isCollapsed: false })
    if (previousGroupId != null && previousGroupId !== groupId) {
      await pruneEmptyGroups(groupId)
    }
  })
}

/** Append runs to an existing session (mobile path: HTML5 drag can't do this). */
export async function addRunsToGroup(runIds: number[], groupId: number): Promise<void> {
  if (runIds.length === 0) return
  await db.transaction('rw', db.runs, db.runGroups, async () => {
    const group = await db.runGroups.get(groupId)
    if (!group) return
    const ids = new Set(runIds)
    const runs = await db.runs.toArray()
    const members = runs
      .filter((run) => run.groupId === groupId && run.id != null && !ids.has(run.id))
      .sort(compareRunTimeline)
    const moved = runs.filter((run) => run.id != null && ids.has(run.id)).sort(compareRunTimeline)
    if (moved.length === 0) return
    // A session that has never been reordered is a pure timeline, so inserted
    // runs fall into place by start time; once ordered by hand, they append.
    const wasManual = members.some((member) => typeof member.sortOrder === 'number')
    const ordered = wasManual
      ? [...members, ...moved]
      : [...members, ...moved].sort(compareRunTimeline)
    for (let i = 0; i < ordered.length; i += 1) {
      const member = ordered[i]
      if (member.id != null) await db.runs.update(member.id, { groupId, sortOrder: (i + 1) * 10 })
    }
    if (group.isCollapsed) await db.runGroups.update(groupId, { isCollapsed: false })
    await pruneEmptyGroups(groupId)
  })
}

/** Drop a run out of its session: it lands just after the session in history. */
export async function removeRunFromGroup(runId: number): Promise<void> {
  await db.transaction('rw', db.runs, db.runGroups, async () => {
    const { runs, groups } = await readAll()
    const run = runs.find((item) => item.id === runId)
    if (!run || run.groupId == null) return
    const rows = buildRunRows(runs, groups)
    const groupIndex = rows.findIndex(
      (row) => row.kind === 'group' && row.group.id === run.groupId,
    )
    const insertAt = groupIndex >= 0 ? groupIndex + 1 : rows.length
    rows.splice(insertAt, 0, { kind: 'run', run })
    await renumberTop(rows)
    await pruneEmptyGroups()
  })
}

/**
 * Reorder the history (groups + ungrouped runs). Dropping onto a group is
 * handled by moveRunToGroup in the screen; `target === null` means "end".
 */
export async function moveTopLevelRunItem(
  dragged: RunItem,
  target: RunItem | null,
  position: DropPos = 'after',
): Promise<void> {
  if (target && target.kind === dragged.kind && target.id === dragged.id) return

  await db.transaction('rw', db.runs, db.runGroups, async () => {
    const { runs, groups } = await readAll()
    const rows = buildRunRows(runs, groups)
    const draggedRun = dragged.kind === 'run' ? runs.find((run) => run.id === dragged.id) : null
    if (dragged.kind === 'run' && !draggedRun) return

    // A run can be dragged out of a session from the nested list too.
    const remaining = rows.filter((row) =>
      row.kind === dragged.kind &&
      (row.kind === 'group' ? row.group.id : row.run.id) === dragged.id,
    )
    const rest = rows.filter((row) => !remaining.includes(row))

    let insertAt = rest.length
    if (target) {
      let index = rest.findIndex((row) =>
        row.kind === target.kind &&
        (row.kind === 'group' ? row.group.id : row.run.id) === target.id,
      )
      if (index < 0 && target.kind === 'run') {
        // Target was nested in a group: place beside its group instead.
        const groupId = runs.find((run) => run.id === target.id)?.groupId ?? null
        index = rest.findIndex((row) => row.kind === 'group' && row.group.id === groupId)
      }
      if (index >= 0) insertAt = position === 'before' ? index : index + 1
    }

    const moved: RunRow | null =
      dragged.kind === 'group'
        ? (() => {
            const group = groups.find((item) => item.id === dragged.id)
            return group ? { kind: 'group', group, runs: [] } : null
          })()
        : draggedRun
          ? { kind: 'run', run: draggedRun }
          : null
    if (!moved) return

    rest.splice(insertAt, 0, moved)
    await renumberTop(rest)
    if (dragged.kind === 'run' && draggedRun?.groupId != null) await pruneEmptyGroups()
  })
}

/** One-step move used by the ↑ / ↓ buttons (works on touch, unlike drag). */
export async function moveTopLevelRunByOffset(item: RunItem, delta: -1 | 1): Promise<void> {
  await db.transaction('rw', db.runs, db.runGroups, async () => {
    const { runs, groups } = await readAll()
    const rows = buildRunRows(runs, groups)
    const index = rows.findIndex((row) =>
      row.kind === item.kind && (row.kind === 'group' ? row.group.id : row.run.id) === item.id,
    )
    const next = index + delta
    if (index < 0 || next < 0 || next >= rows.length) return
    const [moved] = rows.splice(index, 1)
    rows.splice(next, 0, moved)
    await renumberTop(rows)
  })
}

/**
 * Delete a run, its GPS track and any session that is left empty. Deleting a
 * run from the detail screen must not leave an unreachable runGroup behind.
 */
export async function deleteRun(runId: number): Promise<void> {
  await db.transaction('rw', db.runs, db.runTracks, db.runGroups, async () => {
    await db.runs.delete(runId)
    await db.runTracks.delete(runId)
    await pruneEmptyGroups()
  })
}

/** One-step move inside a session's timeline. */
export async function moveRunInGroupByOffset(runId: number, delta: -1 | 1): Promise<void> {
  await db.transaction('rw', db.runs, db.runGroups, async () => {
    const run = await db.runs.get(runId)
    if (!run || run.groupId == null) return
    const members = (await db.runs.toArray())
      .filter((item) => item.groupId === run.groupId)
      .sort(compareRunTimeline)
    const index = members.findIndex((item) => item.id === runId)
    const next = index + delta
    if (index < 0 || next < 0 || next >= members.length) return
    const [moved] = members.splice(index, 1)
    members.splice(next, 0, moved)
    for (let i = 0; i < members.length; i += 1) {
      const member = members[i]
      if (member.id != null) await db.runs.update(member.id, { sortOrder: (i + 1) * 10 })
    }
  })
}
