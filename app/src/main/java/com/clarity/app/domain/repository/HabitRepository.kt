package com.clarity.app.domain.repository

import com.clarity.app.data.local.database.HabitEntity
import kotlinx.coroutines.flow.Flow

interface HabitRepository {
    fun getActiveHabits(): Flow<List<HabitEntity>>
    fun getArchivedHabits(): Flow<List<HabitEntity>>
    fun getMetricsHabits(): Flow<List<HabitEntity>>
    fun getHabitById(habitId: Long): Flow<HabitEntity?>
    suspend fun insertHabit(habit: HabitEntity): Long
    suspend fun updateHabit(habit: HabitEntity)
    suspend fun updateHabitDailyNote(habitId: Long, date: String, note: String)
    suspend fun softDeleteHabit(habitId: Long)
    suspend fun toggleHabitForDate(habitId: Long, date: String, completed: Boolean)
    suspend fun completeHabitLate(habitId: Long, date: String)
    suspend fun setHabitMissed(habitId: Long, date: String)
    suspend fun archiveHabit(habitId: Long, archivedAt: Long = System.currentTimeMillis())
    suspend fun unarchiveHabit(habitId: Long)
}
