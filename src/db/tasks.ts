import { db } from './db'
import type { Task } from './types'

export function newTask(partial: Partial<Task> & { title: string }): Task {
  const now = Date.now()
  return {
    description: '',
    priority: 'Medium',
    category: '',
    tags: [],
    dueDate: null,
    reminderTime: null,
    isCompleted: false,
    isRecurring: false,
    recurringType: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

export async function toggleTaskCompletion(taskId: number, isCompleted: boolean): Promise<void> {
  const task = await db.tasks.get(taskId)
  if (!task) return
  await db.tasks.update(taskId, { isCompleted, updatedAt: Date.now() })

  // Completing a recurring task spawns the next occurrence.
  if (isCompleted && task.isRecurring && task.recurringType) {
    const nextDueDate = nextRecurringDate(task.dueDate, task.recurringType)
    const now = Date.now()
    await db.tasks.add({
      ...task,
      id: undefined,
      isCompleted: false,
      dueDate: nextDueDate,
      createdAt: now,
      updatedAt: now,
    })
  }
}

export function nextRecurringDate(currentDueDate: number | null, type: string): number | null {
  if (currentDueDate == null) return null
  const d = new Date(currentDueDate)
  switch (type) {
    case 'Daily':
      d.setDate(d.getDate() + 1)
      break
    case 'Weekly':
      d.setDate(d.getDate() + 7)
      break
    case 'Monthly':
      d.setMonth(d.getMonth() + 1)
      break
    case 'Custom':
    default:
      d.setDate(d.getDate() + 1)
  }
  return d.getTime()
}

export async function deleteTaskCascade(task: Task): Promise<void> {
  if (task.id == null) return
  await db.transaction('rw', db.tasks, db.subtasks, async () => {
    await db.subtasks.where('taskId').equals(task.id!).delete()
    await db.tasks.delete(task.id!)
  })
}
