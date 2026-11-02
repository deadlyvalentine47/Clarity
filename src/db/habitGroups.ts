import { db } from './db'
import type { Habit, HabitGroup } from './types'
import { compareHabits } from './habits'

export type TopItem = { kind: 'habit'; id: number } | { kind: 'group'; id: number }

export type TopLevelRow =
  | { kind: 'group'; group: HabitGroup; habits: Habit[] }
  | { kind: 'habit'; habit: Habit }

interface Ordered {
  sortOrder?: number
  createdAt: number
  id?: number
}

/** Shared ordering for the mixed list of top-level habits and groups. */
export function compareGroupOrder(a: Ordered, b: Ordered): number {
  const ao = a.sortOrder ?? Number.MAX_SAFE_INTEGER
  const bo = b.sortOrder ?? Number.MAX_SAFE_INTEGER
  if (ao !== bo) return ao - bo
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
  return (a.id ?? 0) - (b.id ?? 0)
}

/** Habits bucketed by group id, each bucket in manual order. */
export function habitsByGroup(habits: Habit[], groups: HabitGroup[]): Map<number, Habit[]> {
  const buckets = new Map<number, Habit[]>()
  for (const group of groups) if (group.id != null) buckets.set(group.id, [])
  for (const habit of habits) {
    const bucket = habit.groupId != null ? buckets.get(habit.groupId) : undefined
    if (bucket) bucket.push(habit)
  }
  for (const bucket of buckets.values()) bucket.sort(compareHabits)
  return buckets
}

/**
 * The habits screen list: groups and ungrouped habits interleaved by their
 * shared sortOrder. Habits pointing at a missing group fall back to ungrouped.
 */
export function buildTopLevelRows(habits: Habit[], groups: HabitGroup[]): TopLevelRow[] {
  const buckets = habitsByGroup(habits, groups)
  const valid = new Set(groups.map((g) => g.id))
  const ungrouped = habits
    .filter((h) => h.groupId == null || !valid.has(h.groupId))
    .sort(compareHabits)

  const entries: ({ kind: 'group'; group: HabitGroup } | { kind: 'habit'; habit: Habit })[] = [
    ...groups.map((group) => ({ kind: 'group' as const, group })),
    ...ungrouped.map((habit) => ({ kind: 'habit' as const, habit })),
  ]
  entries.sort((a, b) => compareGroupOrder(a.kind === 'group' ? a.group : a.habit, b.kind === 'group' ? b.group : b.habit))

  return entries.map((entry) =>
    entry.kind === 'group'
      ? { kind: 'group', group: entry.group, habits: buckets.get(entry.group.id!) ?? [] }
      : { kind: 'habit', habit: entry.habit },
  )
}

function nextTopLevelOrder(habits: Habit[], groups: HabitGroup[]): number {
  const valid = new Set(groups.map((g) => g.id))
  const topHabits = habits.filter((h) => h.groupId == null || !valid.has(h.groupId))
  const max = Math.max(
    0,
    ...groups.map((g) => g.sortOrder ?? 0),
    ...topHabits.map((h) => h.sortOrder ?? 0),
  )
  return max + 10
}

export async function createHabitGroup(name: string): Promise<number> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Group name is required')
  const [habits, groups] = await Promise.all([db.habits.toArray(), db.habitGroups.toArray()])
  const sortOrder = nextTopLevelOrder(habits, groups)
  return (await db.habitGroups.add({
    name: trimmed,
    sortOrder,
    isCollapsed: true,
    createdAt: Date.now(),
  })) as number
}

export async function setHabitGroupCollapsed(groupId: number, collapsed: boolean): Promise<void> {
  await db.habitGroups.update(groupId, { isCollapsed: collapsed })
}

export async function renameHabitGroup(groupId: number, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  await db.habitGroups.update(groupId, { name: trimmed })
}

/** Remove a group; its habits return to the main list, nothing is deleted. */
export async function deleteHabitGroup(groupId: number): Promise<void> {
  await db.transaction('rw', db.habits, db.habitGroups, async () => {
    const [habits, groups] = await Promise.all([
      db.habits.toArray(),
      db.habitGroups.toArray(),
    ])
    const members = habits.filter((h) => h.groupId === groupId).sort(compareHabits)
    const remaining = groups.filter((g) => g.id !== groupId)
    let order = nextTopLevelOrder(
      habits.filter((h) => h.groupId !== groupId),
      remaining,
    )
    order -= 10
    for (const habit of members) {
      if (habit.id == null) continue
      order += 10
      await db.habits.update(habit.id, { groupId: null, sortOrder: order })
    }
    await db.habitGroups.delete(groupId)
  })
}

/** Move a habit among the group's members, or append it at the end. */
export async function moveHabitToGroup(
  habitId: number,
  groupId: number,
  options: { targetHabitId?: number | null; position?: 'before' | 'after' | 'end' } = {},
): Promise<void> {
  const { targetHabitId = null, position = 'end' } = options
  await db.transaction('rw', db.habits, db.habitGroups, async () => {
    const group = await db.habitGroups.get(groupId)
    if (!group) return
    const habit = await db.habits.get(habitId)
    if (!habit) return

    const members = (await db.habits.toArray())
      .filter((h) => h.id !== habitId && h.groupId === groupId)
      .sort(compareHabits)

    let insertAt = members.length
    if (targetHabitId != null) {
      const index = members.findIndex((h) => h.id === targetHabitId)
      if (index >= 0) insertAt = position === 'before' ? index : index + 1
    }
    members.splice(insertAt, 0, habit)

    for (let i = 0; i < members.length; i += 1) {
      const member = members[i]
      if (member.id == null) continue
      const patch: Partial<Habit> = { sortOrder: (i + 1) * 10 }
      if (member.id === habitId) patch.groupId = groupId
      await db.habits.update(member.id, patch)
    }
  })
}

/**
 * Reorder the mixed top-level list (groups + ungrouped habits). Dropping a
 * grouped habit here also pulls it out of its group.
 */
export async function moveTopLevelItem(
  dragged: TopItem,
  target: TopItem | null,
  position: 'before' | 'after' = 'after',
): Promise<void> {
  if (target && target.kind === dragged.kind && target.id === dragged.id) return

  await db.transaction('rw', db.habits, db.habitGroups, async () => {
    const [habits, groups] = await Promise.all([
      db.habits.toArray(),
      db.habitGroups.toArray(),
    ])
    const valid = new Set(groups.map((g) => g.id))
    const topHabits = habits.filter((h) => h.groupId == null || !valid.has(h.groupId))

    type Entry = {
      kind: 'habit' | 'group'
      id: number
      sortOrder?: number
      createdAt: number
    }
    let entries: Entry[] = [
      ...topHabits.map((h) => ({
        kind: 'habit' as const,
        id: h.id!,
        sortOrder: h.sortOrder,
        createdAt: h.createdAt,
      })),
      ...groups.map((g) => ({
        kind: 'group' as const,
        id: g.id!,
        sortOrder: g.sortOrder,
        createdAt: g.createdAt,
      })),
    ]
    entries = entries
      .filter((entry) => !(entry.kind === dragged.kind && entry.id === dragged.id))
      .sort(compareGroupOrder)

    let insertAt = entries.length
    if (target) {
      const index = entries.findIndex((entry) => entry.kind === target.kind && entry.id === target.id)
      if (index >= 0) insertAt = position === 'before' ? index : index + 1
    }
    entries.splice(insertAt, 0, {
      kind: dragged.kind,
      id: dragged.id,
      createdAt: 0,
    })

    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i]
      const sortOrder = (i + 1) * 10
      if (entry.kind === 'group') {
        await db.habitGroups.update(entry.id, { sortOrder })
      } else {
        const habit = habits.find((h) => h.id === entry.id)
        const patch: Partial<Habit> = { sortOrder }
        if (habit?.groupId != null) patch.groupId = null
        await db.habits.update(entry.id, patch)
      }
    }
  })
}
