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
    val tasks: List<ExportTask> = emptyList(),
    val habits: List<ExportHabit> = emptyList(),
    val notes: List<ExportNote> = emptyList(),
    val transactions: List<ExportTransaction> = emptyList(),
    val goals: List<ExportGoal> = emptyList(),
    val events: List<ExportEvent> = emptyList(),
    val categories: List<ExportCategory> = emptyList(),
    val sources: List<ExportSource> = emptyList(),
    val noteCategories: List<ExportNoteCategory> = emptyList(),
    val budgetLimits: List<ExportBudgetLimit> = emptyList(),
    val subtasks: List<ExportSubtask> = emptyList(),
    val pomodoroSessions: List<ExportPomodoroSession> = emptyList(),
    val pomodoroFocusSessions: List<ExportPomodoroFocusSession> = emptyList(),
    val creditCards: List<ExportCreditCard> = emptyList(),
    val creditCardTransactions: List<ExportCreditCardTransaction> = emptyList(),
    val investments: List<ExportInvestment> = emptyList()
)

@Serializable
data class ExportTask(
    val id: Long = 0,
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
    val id: Long = 0,
    val name: String,
    val description: String,
    val frequency: String,
    val alternateDays: Int? = null,
    val selectedDays: List<Int>? = null,
    val targetCount: Int,
    val currentStreak: Int,
    val bestStreak: Int,
    val completionHistory: Map<String, Boolean>,
    val reminderTime: Long?,
    val isArchived: Boolean,
    val archivedAt: Long? = null,
    val isDeleted: Boolean = false,
    val deletedAt: Long? = null,
    val deadlineHour: Int? = null,
    val deadlineMinute: Int? = null,
    val createdAt: Long
)

@Serializable
data class ExportNote(
    val id: Long = 0,
    val title: String,
    val content: String,
    val isPinned: Boolean,
    val category: String,
    val createdAt: Long,
    val updatedAt: Long
)

@Serializable
data class ExportTransaction(
    val id: Long = 0,
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
    val id: Long = 0,
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
    val id: Long = 0,
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

@Serializable
data class ExportCategory(
    val id: Long = 0,
    val name: String,
    val isDefault: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
data class ExportSource(
    val id: Long = 0,
    val name: String,
    val balance: Double = 0.0,
    val isDefault: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
data class ExportNoteCategory(
    val id: Long = 0,
    val name: String,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
data class ExportBudgetLimit(
    val id: Long = 0,
    val category: String,
    val limitAmount: Double,
    val month: Int,
    val year: Int,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
data class ExportSubtask(
    val id: Long = 0,
    val taskId: Long,
    val title: String,
    val isCompleted: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
data class ExportPomodoroSession(
    val id: Long = 0,
    val taskId: Long? = null,
    val duration: Int,
    val type: String,
    val completedAt: Long = System.currentTimeMillis(),
    val distractions: List<String> = emptyList()
)

@Serializable
data class ExportPomodoroFocusSession(
    val id: Long = 0,
    val title: String,
    val focusDurationMinutes: Int = 25,
    val breakDurationMinutes: Int = 5,
    val sessionCount: Int = 0,
    val totalFocusMinutes: Int = 0,
    val distractions: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

@Serializable
data class ExportCreditCard(
    val id: Long = 0,
    val name: String,
    val creditLimit: Double,
    val billingCycleDay: Int,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
data class ExportCreditCardTransaction(
    val id: Long = 0,
    val cardId: Long,
    val amount: Double,
    val description: String = "",
    val date: Long = System.currentTimeMillis(),
    val type: String,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
data class ExportInvestment(
    val id: Long = 0,
    val name: String,
    val type: String,
    val units: Double,
    val purchasePrice: Double,
    val currentPrice: Double,
    val purchaseDate: Long,
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis()
)

object DataExporter {
    private val json = Json { prettyPrint = true; ignoreUnknownKeys = true }

    suspend fun exportToJson(context: Context, database: ClarityDatabase): String = withContext(Dispatchers.IO) {
        val tasks = database.taskDao().getAllTasks().first().map {
            ExportTask(
                id = it.id,
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
                id = it.id,
                name = it.name,
                description = it.description,
                frequency = it.frequency,
                alternateDays = it.alternateDays,
                selectedDays = it.selectedDays,
                targetCount = it.targetCount,
                currentStreak = it.currentStreak,
                bestStreak = it.bestStreak,
                completionHistory = it.completionHistory,
                reminderTime = it.reminderTime,
                isArchived = it.isArchived,
                archivedAt = it.archivedAt,
                isDeleted = it.isDeleted,
                deletedAt = it.deletedAt,
                deadlineHour = it.deadlineHour,
                deadlineMinute = it.deadlineMinute,
                createdAt = it.createdAt
            )
        }

        val notes = database.noteDao().getAllNotes().first().map {
            ExportNote(
                id = it.id,
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
                id = it.id,
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
                id = it.id,
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
                id = it.id,
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

        val categories = database.categoryDao().getAllCategories().first().map {
            ExportCategory(
                id = it.id,
                name = it.name,
                isDefault = it.isDefault,
                createdAt = it.createdAt
            )
        }

        val sources = database.sourceDao().getAllSources().first().map {
            ExportSource(
                id = it.id,
                name = it.name,
                balance = it.balance,
                isDefault = it.isDefault,
                createdAt = it.createdAt
            )
        }

        val noteCategories = database.noteCategoryDao().getAllCategories().first().map {
            ExportNoteCategory(
                id = it.id,
                name = it.name,
                createdAt = it.createdAt
            )
        }

        val budgetLimits = database.budgetLimitDao().getAllBudgetLimits().map {
            ExportBudgetLimit(
                id = it.id,
                category = it.category,
                limitAmount = it.limitAmount,
                month = it.month,
                year = it.year,
                createdAt = it.createdAt
            )
        }

        val subtasks = database.subtaskDao().getAllSubtasks().map {
            ExportSubtask(
                id = it.id,
                taskId = it.taskId,
                title = it.title,
                isCompleted = it.isCompleted,
                createdAt = it.createdAt
            )
        }

        val pomodoroSessions = database.pomodoroSessionDao().getAllSessions().first().map {
            ExportPomodoroSession(
                id = it.id,
                taskId = it.taskId,
                duration = it.duration,
                type = it.type,
                completedAt = it.completedAt,
                distractions = it.distractions
            )
        }

        val pomodoroFocusSessions = database.pomodoroFocusSessionDao().getAllSessions().first().map {
            ExportPomodoroFocusSession(
                id = it.id,
                title = it.title,
                focusDurationMinutes = it.focusDurationMinutes,
                breakDurationMinutes = it.breakDurationMinutes,
                sessionCount = it.sessionCount,
                totalFocusMinutes = it.totalFocusMinutes,
                distractions = it.distractions,
                createdAt = it.createdAt,
                updatedAt = it.updatedAt
            )
        }

        val creditCards = database.creditCardDao().getAllCards().first().map {
            ExportCreditCard(
                id = it.id,
                name = it.name,
                creditLimit = it.creditLimit,
                billingCycleDay = it.billingCycleDay,
                createdAt = it.createdAt
            )
        }

        val creditCardTransactions = database.creditCardTransactionDao().getAllTransactions().map {
            ExportCreditCardTransaction(
                id = it.id,
                cardId = it.cardId,
                amount = it.amount,
                description = it.description,
                date = it.date,
                type = it.type,
                createdAt = it.createdAt
            )
        }

        val investments = database.investmentDao().getAllInvestments().first().map {
            ExportInvestment(
                id = it.id,
                name = it.name,
                type = it.type,
                units = it.units,
                purchasePrice = it.purchasePrice,
                currentPrice = it.currentPrice,
                purchaseDate = it.purchaseDate,
                notes = it.notes,
                createdAt = it.createdAt
            )
        }

        val appData = AppData(
            tasks = tasks,
            habits = habits,
            notes = notes,
            transactions = transactions,
            goals = goals,
            events = events,
            categories = categories,
            sources = sources,
            noteCategories = noteCategories,
            budgetLimits = budgetLimits,
            subtasks = subtasks,
            pomodoroSessions = pomodoroSessions,
            pomodoroFocusSessions = pomodoroFocusSessions,
            creditCards = creditCards,
            creditCardTransactions = creditCardTransactions,
            investments = investments
        )
        json.encodeToString(appData)
    }

    suspend fun importFromJson(context: Context, database: ClarityDatabase, uri: Uri): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val inputStream = context.contentResolver.openInputStream(uri) ?: return@withContext Result.failure(Exception("Cannot open file"))
            val reader = BufferedReader(InputStreamReader(inputStream))
            val jsonString = reader.readText()
            reader.close()

            val appData = json.decodeFromString<AppData>(jsonString)

            database.taskDao().deleteAllTasks()
            database.habitDao().deleteAllHabits()
            database.noteDao().deleteAllNotes()
            database.transactionDao().deleteAllTransactions()
            database.goalDao().deleteAllGoals()
            database.eventDao().deleteAllEvents()
            database.categoryDao().deleteAllCategories()
            database.sourceDao().deleteAllSources()
            database.noteCategoryDao().deleteAllCategories()
            database.budgetLimitDao().deleteAllBudgetLimits()
            database.subtaskDao().deleteAllSubtasks()
            database.pomodoroSessionDao().deleteAllSessions()
            database.pomodoroFocusSessionDao().deleteAllSessions()
            database.creditCardDao().deleteAllCards()
            database.creditCardTransactionDao().deleteAllTransactions()
            database.investmentDao().deleteAllInvestments()

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
                        alternateDays = exportHabit.alternateDays,
                        selectedDays = exportHabit.selectedDays,
                        targetCount = exportHabit.targetCount,
                        currentStreak = exportHabit.currentStreak,
                        bestStreak = exportHabit.bestStreak,
                        completionHistory = exportHabit.completionHistory,
                        reminderTime = exportHabit.reminderTime,
                        isArchived = exportHabit.isArchived,
                        archivedAt = exportHabit.archivedAt,
                        isDeleted = exportHabit.isDeleted,
                        deletedAt = exportHabit.deletedAt,
                        deadlineHour = exportHabit.deadlineHour,
                        deadlineMinute = exportHabit.deadlineMinute,
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

            appData.categories.forEach { exportCategory ->
                database.categoryDao().insertCategory(
                    com.clarity.app.data.local.database.CategoryEntity(
                        name = exportCategory.name,
                        isDefault = exportCategory.isDefault,
                        createdAt = exportCategory.createdAt
                    )
                )
            }

            appData.sources.forEach { exportSource ->
                database.sourceDao().insertSource(
                    com.clarity.app.data.local.database.SourceEntity(
                        name = exportSource.name,
                        balance = exportSource.balance,
                        isDefault = exportSource.isDefault,
                        createdAt = exportSource.createdAt
                    )
                )
            }

            appData.noteCategories.forEach { exportNoteCategory ->
                database.noteCategoryDao().insertCategory(
                    com.clarity.app.data.local.database.NoteCategoryEntity(
                        name = exportNoteCategory.name,
                        createdAt = exportNoteCategory.createdAt
                    )
                )
            }

            appData.budgetLimits.forEach { exportBudgetLimit ->
                database.budgetLimitDao().insertBudgetLimit(
                    com.clarity.app.data.local.database.BudgetLimitEntity(
                        category = exportBudgetLimit.category,
                        limitAmount = exportBudgetLimit.limitAmount,
                        month = exportBudgetLimit.month,
                        year = exportBudgetLimit.year,
                        createdAt = exportBudgetLimit.createdAt
                    )
                )
            }

            appData.subtasks.forEach { exportSubtask ->
                database.subtaskDao().insertSubtask(
                    com.clarity.app.data.local.database.SubtaskEntity(
                        taskId = exportSubtask.taskId,
                        title = exportSubtask.title,
                        isCompleted = exportSubtask.isCompleted,
                        createdAt = exportSubtask.createdAt
                    )
                )
            }

            appData.pomodoroSessions.forEach { exportSession ->
                database.pomodoroSessionDao().insertSession(
                    com.clarity.app.data.local.database.PomodoroSessionEntity(
                        taskId = exportSession.taskId,
                        duration = exportSession.duration,
                        type = exportSession.type,
                        completedAt = exportSession.completedAt,
                        distractions = exportSession.distractions
                    )
                )
            }

            appData.pomodoroFocusSessions.forEach { exportSession ->
                database.pomodoroFocusSessionDao().insertSession(
                    com.clarity.app.data.local.database.PomodoroFocusSessionEntity(
                        title = exportSession.title,
                        focusDurationMinutes = exportSession.focusDurationMinutes,
                        breakDurationMinutes = exportSession.breakDurationMinutes,
                        sessionCount = exportSession.sessionCount,
                        totalFocusMinutes = exportSession.totalFocusMinutes,
                        distractions = exportSession.distractions,
                        createdAt = exportSession.createdAt,
                        updatedAt = exportSession.updatedAt
                    )
                )
            }

            appData.creditCards.forEach { exportCard ->
                database.creditCardDao().insertCard(
                    com.clarity.app.data.local.database.CreditCardEntity(
                        name = exportCard.name,
                        creditLimit = exportCard.creditLimit,
                        billingCycleDay = exportCard.billingCycleDay,
                        createdAt = exportCard.createdAt
                    )
                )
            }

            appData.creditCardTransactions.forEach { exportTx ->
                database.creditCardTransactionDao().insertTransaction(
                    com.clarity.app.data.local.database.CreditCardTransactionEntity(
                        cardId = exportTx.cardId,
                        amount = exportTx.amount,
                        description = exportTx.description,
                        date = exportTx.date,
                        type = exportTx.type,
                        createdAt = exportTx.createdAt
                    )
                )
            }

            appData.investments.forEach { exportInv ->
                database.investmentDao().insertInvestment(
                    com.clarity.app.data.local.database.InvestmentEntity(
                        name = exportInv.name,
                        type = exportInv.type,
                        units = exportInv.units,
                        purchasePrice = exportInv.purchasePrice,
                        currentPrice = exportInv.currentPrice,
                        purchaseDate = exportInv.purchaseDate,
                        notes = exportInv.notes,
                        createdAt = exportInv.createdAt
                    )
                )
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
