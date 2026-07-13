package com.clarity.app.util

import android.content.Context
import android.net.Uri
import com.clarity.app.data.local.database.ClarityDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.BufferedReader
import java.io.InputStreamReader

@Serializable
data class AppData(
    val tasks: List<ExportTask>,
    val habits: List<ExportHabit>,
    val notes: List<ExportNote>,
    val transactions: List<ExportTransaction>,
    val goals: List<ExportGoal>,
    val events: List<ExportEvent>
)

@Serializable
data class ExportTask(
    val title: String,
    val description: String,
    val priority: String,
    val category: String,
    val tags: List<String>,
    val dueDate: Long?,
    val reminderTime: Long?,
    val isCompleted: Boolean,
    val isRecurring: Boolean,
    val recurringType: String?,
    val createdAt: Long,
    val updatedAt: Long
)

@Serializable
data class ExportHabit(
    val name: String,
    val description: String,
    val frequency: String,
    val targetCount: Int,
    val currentStreak: Int,
    val bestStreak: Int,
    val completionHistory: Map<String, Boolean>,
    val reminderTime: Long?,
    val isArchived: Boolean,
    val createdAt: Long
)

@Serializable
data class ExportNote(
    val title: String,
    val content: String,
    val isPinned: Boolean,
    val category: String,
    val createdAt: Long,
    val updatedAt: Long
)

@Serializable
data class ExportTransaction(
    val type: String,
    val amount: Double,
    val category: String,
    val source: String = "",
    val description: String,
    val date: Long,
    val isRecurring: Boolean,
    val recurringType: String?,
    val createdAt: Long
)

@Serializable
data class ExportGoal(
    val title: String,
    val description: String,
    val type: String,
    val progress: Float,
    val targetDate: Long?,
    val milestones: List<String>,
    val completedMilestones: List<String>,
    val isCompleted: Boolean,
    val createdAt: Long
)

@Serializable
data class ExportEvent(
    val title: String,
    val description: String,
    val startDate: Long,
    val endDate: Long,
    val category: String,
    val color: String,
    val isAllDay: Boolean,
    val reminderTime: Long?,
    val createdAt: Long
)

object DataExporter {
    private val json = Json { prettyPrint = true; ignoreUnknownKeys = true }

    suspend fun exportToJson(context: Context, database: ClarityDatabase): String = withContext(Dispatchers.IO) {
        val tasks = database.taskDao().getAllTasks().first().map {
            ExportTask(
                title = it.title,
                description = it.description,
                priority = it.priority,
                category = it.category,
                tags = it.tags,
                dueDate = it.dueDate,
                reminderTime = it.reminderTime,
                isCompleted = it.isCompleted,
                isRecurring = it.isRecurring,
                recurringType = it.recurringType,
                createdAt = it.createdAt,
                updatedAt = it.updatedAt
            )
        }

        val habits = database.habitDao().getAllHabits().first().map {
            ExportHabit(
                name = it.name,
                description = it.description,
                frequency = it.frequency,
                targetCount = it.targetCount,
                currentStreak = it.currentStreak,
                bestStreak = it.bestStreak,
                completionHistory = it.completionHistory,
                reminderTime = it.reminderTime,
                isArchived = it.isArchived,
                createdAt = it.createdAt
            )
        }

        val notes = database.noteDao().getAllNotes().first().map {
            ExportNote(
                title = it.title,
                content = it.content,
                isPinned = it.isPinned,
                category = it.category,
                createdAt = it.createdAt,
                updatedAt = it.updatedAt
            )
        }

        val transactions = database.transactionDao().getAllTransactions().first().map {
            ExportTransaction(
                type = it.type,
                amount = it.amount,
                category = it.category,
                source = it.source,
                description = it.description,
                date = it.date,
                isRecurring = it.isRecurring,
                recurringType = it.recurringType,
                createdAt = it.createdAt
            )
        }

        val goals = database.goalDao().getAllGoals().first().map {
            ExportGoal(
                title = it.title,
                description = it.description,
                type = it.type,
                progress = it.progress,
                targetDate = it.targetDate,
                milestones = it.milestones,
                completedMilestones = it.completedMilestones,
                isCompleted = it.isCompleted,
                createdAt = it.createdAt
            )
        }

        val events = database.eventDao().getAllEvents().first().map {
            ExportEvent(
                title = it.title,
                description = it.description,
                startDate = it.startDate,
                endDate = it.endDate,
                category = it.category,
                color = it.color,
                isAllDay = it.isAllDay,
                reminderTime = it.reminderTime,
                createdAt = it.createdAt
            )
        }

        val appData = AppData(tasks, habits, notes, transactions, goals, events)
        json.encodeToString(appData)
    }

    suspend fun importFromJson(context: Context, database: ClarityDatabase, uri: Uri): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val inputStream = context.contentResolver.openInputStream(uri) ?: return@withContext Result.failure(Exception("Cannot open file"))
            val reader = BufferedReader(InputStreamReader(inputStream))
            val jsonString = reader.readText()
            reader.close()

            val appData = json.decodeFromString<AppData>(jsonString)

            // Clear existing data before importing
            database.taskDao().deleteAllTasks()
            database.habitDao().deleteAllHabits()
            database.noteDao().deleteAllNotes()
            database.transactionDao().deleteAllTransactions()
            database.goalDao().deleteAllGoals()
            database.eventDao().deleteAllEvents()

            // Insert all data sequentially
            appData.tasks.forEach { exportTask ->
                database.taskDao().insertTask(
                    com.clarity.app.data.local.database.TaskEntity(
                        title = exportTask.title,
                        description = exportTask.description,
                        priority = exportTask.priority,
                        category = exportTask.category,
                        tags = exportTask.tags,
                        dueDate = exportTask.dueDate,
                        reminderTime = exportTask.reminderTime,
                        isCompleted = exportTask.isCompleted,
                        isRecurring = exportTask.isRecurring,
                        recurringType = exportTask.recurringType,
                        createdAt = exportTask.createdAt,
                        updatedAt = exportTask.updatedAt
                    )
                )
            }

            appData.habits.forEach { exportHabit ->
                database.habitDao().insertHabit(
                    com.clarity.app.data.local.database.HabitEntity(
                        name = exportHabit.name,
                        description = exportHabit.description,
                        frequency = exportHabit.frequency,
                        targetCount = exportHabit.targetCount,
                        currentStreak = exportHabit.currentStreak,
                        bestStreak = exportHabit.bestStreak,
                        completionHistory = exportHabit.completionHistory,
                        reminderTime = exportHabit.reminderTime,
                        isArchived = exportHabit.isArchived,
                        createdAt = exportHabit.createdAt
                    )
                )
            }

            appData.notes.forEach { exportNote ->
                database.noteDao().insertNote(
                    com.clarity.app.data.local.database.NoteEntity(
                        title = exportNote.title,
                        content = exportNote.content,
                        isPinned = exportNote.isPinned,
                        category = exportNote.category,
                        createdAt = exportNote.createdAt,
                        updatedAt = exportNote.updatedAt
                    )
                )
            }

            appData.transactions.forEach { exportTransaction ->
                database.transactionDao().insertTransaction(
                    com.clarity.app.data.local.database.TransactionEntity(
                        type = exportTransaction.type,
                        amount = exportTransaction.amount,
                        category = exportTransaction.category,
                        source = exportTransaction.source,
                        description = exportTransaction.description,
                        date = exportTransaction.date,
                        isRecurring = exportTransaction.isRecurring,
                        recurringType = exportTransaction.recurringType,
                        createdAt = exportTransaction.createdAt
                    )
                )
            }

            appData.goals.forEach { exportGoal ->
                database.goalDao().insertGoal(
                    com.clarity.app.data.local.database.GoalEntity(
                        title = exportGoal.title,
                        description = exportGoal.description,
                        type = exportGoal.type,
                        progress = exportGoal.progress,
                        targetDate = exportGoal.targetDate,
                        milestones = exportGoal.milestones,
                        completedMilestones = exportGoal.completedMilestones,
                        isCompleted = exportGoal.isCompleted,
                        createdAt = exportGoal.createdAt
                    )
                )
            }

            appData.events.forEach { exportEvent ->
                database.eventDao().insertEvent(
                    com.clarity.app.data.local.database.EventEntity(
                        title = exportEvent.title,
                        description = exportEvent.description,
                        startDate = exportEvent.startDate,
                        endDate = exportEvent.endDate,
                        category = exportEvent.category,
                        color = exportEvent.color,
                        isAllDay = exportEvent.isAllDay,
                        reminderTime = exportEvent.reminderTime,
                        createdAt = exportEvent.createdAt
                    )
                )
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
