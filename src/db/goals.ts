import type { Goal, GoalStatus } from './types'
import { db } from './db'

export const GOAL_STATUSES: GoalStatus[] = ['In Progress', 'On Hold', 'Completed']

/** Older rows predate `status`; infer it from the legacy `isCompleted` flag. */
export function goalStatus(goal: Goal): GoalStatus {
  return goal.status ?? (goal.isCompleted ? 'Completed' : 'In Progress')
}

export function milestonesDone(goal: Goal): number {
  return goal.milestones.filter((m) => m.completedAt != null).length
}

export function allMilestonesDone(goal: Goal): boolean {
  return goal.milestones.length > 0 && milestonesDone(goal) === goal.milestones.length
}

/**
 * Milestone completion drives the bar, but it caps at 99%: the last percent is
 * reserved for the user explicitly marking the whole goal Completed.
 */
export function goalProgress(goal: Goal): number {
  if (goalStatus(goal) === 'Completed') return 1
  if (goal.milestones.length === 0) return 0
  return Math.min(0.99, milestonesDone(goal) / goal.milestones.length)
}

/** Keep the legacy `progress`/`isCompleted` columns in sync with `status`. */
export function withDerived(goal: Goal): Goal {
  const status = goalStatus(goal)
  return {
    ...goal,
    status,
    progress: goalProgress({ ...goal, status }),
    isCompleted: status === 'Completed',
  }
}

export async function setGoalStatus(goal: Goal, status: GoalStatus): Promise<void> {
  // Completed only becomes available once every milestone is checked off.
  if (status === 'Completed' && !allMilestonesDone(goal)) return
  await db.goals.put(
    withDerived({
      ...goal,
      status,
      completedAt: status === 'Completed' ? (goal.completedAt ?? Date.now()) : null,
    }),
  )
}

export async function toggleGoalMilestone(
  goal: Goal,
  milestoneId: string,
  done: boolean,
): Promise<void> {
  const milestones = goal.milestones.map((m) =>
    m.id === milestoneId ? { ...m, completedAt: done ? (m.completedAt ?? Date.now()) : null } : m,
  )

  // Unchecking a milestone invalidates a Completed goal — move it back.
  const status = goalStatus(goal)
  const stillComplete = milestones.length > 0 && milestones.every((m) => m.completedAt != null)
  const nextStatus: GoalStatus = status === 'Completed' && !stillComplete ? 'In Progress' : status

  await db.goals.put(
    withDerived({
      ...goal,
      status: nextStatus,
      milestones,
      completedAt: nextStatus === 'Completed' ? goal.completedAt ?? null : null,
    }),
  )
}

export async function setMilestoneNote(
  goal: Goal,
  milestoneId: string,
  note: string,
): Promise<void> {
  const milestones = goal.milestones.map((m) => (m.id === milestoneId ? { ...m, note } : m))
  await db.goals.put({ ...goal, milestones })
}
