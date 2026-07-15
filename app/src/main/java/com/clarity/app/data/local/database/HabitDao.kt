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

    @Query("SELECT * FROM habits WHERE isArchived = 0 ORDER BY createdAt DESC")
    fun getActiveHabits(): Flow<List<HabitEntity>>

    @Query("SELECT * FROM habits WHERE isArchived = 1 ORDER BY createdAt DESC")
    fun getArchivedHabits(): Flow<List<HabitEntity>>

    @Query("SELECT * FROM habits WHERE id = :habitId")
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

    @Query("UPDATE habits SET isArchived = 1 WHERE id = :habitId")
    suspend fun archiveHabit(habitId: Long)

    @Query("SELECT * FROM habits WHERE id = :habitId")
    suspend fun getHabitByIdOnce(habitId: Long): HabitEntity?

    @Query("UPDATE habits SET completionHistory = :history, currentStreak = :streak WHERE id = :habitId")
    suspend fun updateHabitCompletion(habitId: Long, history: Map<String, Boolean>, streak: Int)

    suspend fun toggleHabitForDate(habitId: Long, date: String, completed: Boolean) {
        val habit = getHabitByIdOnce(habitId) ?: return
        val newHistory = habit.completionHistory.toMutableMap()
        newHistory[date] = completed
        val streak = calculateStreak(newHistory, habit.frequency, habit.alternateDays, habit.selectedDays, habit.createdAt)
        updateHabitCompletion(habitId, newHistory, streak)
    }

    private fun calculateStreak(history: Map<String, Boolean>, frequency: String = "Daily", alternateDays: Int? = null, selectedDays: List<Int>? = null, createdAt: Long = System.currentTimeMillis()): Int {
        var streak = 0
        val today = java.time.LocalDate.now()
        val created = java.time.Instant.ofEpochMilli(createdAt).atZone(java.time.ZoneId.systemDefault()).toLocalDate()

        val todayStr = today.toString()
        val todayInHistory = history.containsKey(todayStr)
        val todayScheduled = when {
            frequency == "Alternate" && alternateDays != null -> {
                java.time.temporal.ChronoUnit.DAYS.between(created, today) % (alternateDays + 1) == 0L
            }
            frequency == "Custom" && selectedDays != null -> {
                today.dayOfWeek.value in selectedDays
            }
            else -> true
        }

        if (todayInHistory && history[todayStr] == false && todayScheduled) {
            return 0
        }

        var currentDate = if (todayInHistory) today else today.minusDays(1)

        while (true) {
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
