package com.clarity.app.data.local.database

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface HabitDao {
    @Query("SELECT * FROM habits ORDER BY createdAt DESC")
    fun getAllHabits(): Flow<List<HabitEntity>>

    @Query("SELECT * FROM habits WHERE isArchived = 0 AND isDeleted = 0 ORDER BY createdAt DESC")
    fun getActiveHabits(): Flow<List<HabitEntity>>

    @Query("SELECT * FROM habits WHERE isArchived = 1 AND isDeleted = 0 ORDER BY createdAt DESC")
    fun getArchivedHabits(): Flow<List<HabitEntity>>

    @Query("SELECT * FROM habits ORDER BY createdAt DESC")
    fun getMetricsHabits(): Flow<List<HabitEntity>>

    @Query("SELECT * FROM habits WHERE id = :habitId AND isDeleted = 0")
    fun getHabitById(habitId: Long): Flow<HabitEntity?>

    @Insert
    suspend fun insertHabit(habit: HabitEntity): Long

    @Update
    suspend fun updateHabit(habit: HabitEntity)

    @Delete
    suspend fun deleteHabit(habit: HabitEntity)

    @Query("DELETE FROM habits WHERE id = :habitId")
    suspend fun deleteHabitById(habitId: Long)

    @Query("DELETE FROM habits")
    suspend fun deleteAllHabits()

    @Query("UPDATE habits SET isArchived = 1, archivedAt = :archivedAt WHERE id = :habitId")
    suspend fun archiveHabit(habitId: Long, archivedAt: Long = System.currentTimeMillis())

    @Query("UPDATE habits SET isArchived = 0 WHERE id = :habitId")
    suspend fun unarchiveHabit(habitId: Long)

    @Query("UPDATE habits SET isDeleted = 1, deletedAt = :deletedAt WHERE id = :habitId")
    suspend fun softDeleteHabit(habitId: Long, deletedAt: Long = System.currentTimeMillis())

    @Query("SELECT * FROM habits WHERE id = :habitId AND isDeleted = 0")
    suspend fun getHabitByIdOnce(habitId: Long): HabitEntity?

    @Query("UPDATE habits SET completionHistory = :history, currentStreak = :streak WHERE id = :habitId")
    suspend fun updateHabitCompletion(habitId: Long, history: Map<String, Boolean>, streak: Int)

    @Query("UPDATE habits SET completionHistory = :history, lateCompletions = :late, currentStreak = :streak WHERE id = :habitId")
    suspend fun updateHabitCompletionWithLate(habitId: Long, history: Map<String, Boolean>, late: Set<String>, streak: Int)

    suspend fun toggleHabitForDate(habitId: Long, date: String, completed: Boolean) {
        val habit = getHabitByIdOnce(habitId) ?: return
        val newHistory = habit.completionHistory.toMutableMap()
        val newLate = habit.lateCompletions.toMutableSet()
        val today = java.time.LocalDate.now().toString()
        if (!completed && date == today) {
            newHistory.remove(date)
            newLate.remove(date)
        } else {
            newHistory[date] = completed
        }
        val streak = calculateStreak(newHistory, habit.frequency, habit.alternateDays, habit.selectedDays, habit.createdAt)
        updateHabitCompletionWithLate(habitId, newHistory, newLate, streak)
    }

    suspend fun toggleHabitLateForDate(habitId: Long, date: String, completed: Boolean) {
        val habit = getHabitByIdOnce(habitId) ?: return
        val newHistory = habit.completionHistory.toMutableMap()
        val newLate = habit.lateCompletions.toMutableSet()
        val today = java.time.LocalDate.now().toString()
        if (!completed && date == today) {
            newHistory.remove(date)
            newLate.remove(date)
        } else {
            newHistory[date] = completed
            if (completed) newLate.add(date) else newLate.remove(date)
        }
        val streak = calculateStreak(newHistory, habit.frequency, habit.alternateDays, habit.selectedDays, habit.createdAt)
        updateHabitCompletionWithLate(habitId, newHistory, newLate, streak)
    }

    suspend fun setHabitMissed(habitId: Long, date: String) {
        val habit = getHabitByIdOnce(habitId) ?: return
        val newHistory = habit.completionHistory.toMutableMap()
        val newLate = habit.lateCompletions.toMutableSet()
        newHistory[date] = false
        newLate.remove(date)
        val streak = calculateStreak(newHistory, habit.frequency, habit.alternateDays, habit.selectedDays, habit.createdAt)
        updateHabitCompletionWithLate(habitId, newHistory, newLate, streak)
    }

    private fun calculateStreak(history: Map<String, Boolean>, frequency: String = "Daily", alternateDays: Int? = null, selectedDays: List<Int>? = null, createdAt: Long = System.currentTimeMillis()): Int {
        var streak = 0
        val today = java.time.LocalDate.now()
        val created = java.time.Instant.ofEpochMilli(createdAt).atZone(java.time.ZoneId.systemDefault()).toLocalDate()

        val todayStr = today.toString()
        val todayCompleted = history[todayStr] == true

        var currentDate = if (todayCompleted) today else today.minusDays(1)

        while (true) {
            if (currentDate.isBefore(created)) break

            val isScheduled = when {
                frequency == "Alternate" && alternateDays != null -> {
                    val daysSinceCreated = java.time.temporal.ChronoUnit.DAYS.between(created, currentDate)
                    daysSinceCreated % (alternateDays + 1) == 0L
                }
                frequency == "Custom" && selectedDays != null -> {
                    currentDate.dayOfWeek.value in selectedDays
                }
                else -> true
            }
            if (!isScheduled) {
                currentDate = currentDate.minusDays(1)
                continue
            }
            val dateStr = currentDate.toString()
            if (history[dateStr] == true) {
                streak++
                currentDate = currentDate.minusDays(1)
            } else {
                break
            }
        }
        return streak
    }
}
