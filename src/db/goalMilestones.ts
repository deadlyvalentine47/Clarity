import type { GoalMilestone } from './types'

let fallbackCounter = 0

export function newMilestoneId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  fallbackCounter += 1
  return `m-${Date.now().toString(36)}-${fallbackCounter.toString(36)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Convert milestones from any stored shape into the current object form.
 * Legacy rows (and old backups) keep `string[]` milestones with completion and
 * notes keyed by text; this folds them into per-milestone ids.
 */
export function normalizeMilestones(
  rawMilestones: unknown,
  legacyCompleted?: unknown,
  legacyNotes?: unknown,
  legacyDates?: unknown,
): GoalMilestone[] {
  if (!Array.isArray(rawMilestones)) return []

  const completed = new Set(
    Array.isArray(legacyCompleted)
      ? legacyCompleted.filter((item): item is string => typeof item === 'string')
      : [],
  )
  const notes = isRecord(legacyNotes) ? legacyNotes : {}
  const dates = isRecord(legacyDates) ? legacyDates : {}

  const seen = new Set<string>()
  const result: GoalMilestone[] = []
  for (const item of rawMilestones) {
    let milestone: GoalMilestone | null = null
    if (typeof item === 'string') {
      milestone = {
        id: newMilestoneId(),
        text: item,
        note: typeof notes[item] === 'string' ? (notes[item] as string) : '',
        completedAt: completed.has(item)
          ? typeof dates[item] === 'number'
            ? (dates[item] as number)
            : null
          : null,
      }
    } else if (isRecord(item) && typeof item.text === 'string') {
      milestone = {
        id: typeof item.id === 'string' && item.id ? item.id : newMilestoneId(),
        text: item.text,
        note: typeof item.note === 'string' ? item.note : '',
        completedAt: typeof item.completedAt === 'number' ? item.completedAt : null,
      }
    }
    if (!milestone) continue
    // Guard against ids colliding when a hand-edited backup repeats one.
    if (seen.has(milestone.id)) milestone.id = newMilestoneId()
    seen.add(milestone.id)
    result.push(milestone)
  }
  return result
}
