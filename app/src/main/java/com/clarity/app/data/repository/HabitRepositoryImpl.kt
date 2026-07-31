package com.clarity.app.data.repository

import com.clarity.app.data.local.database.HabitDao
import com.clarity.app.data.local.database.HabitEntity
import com.clarity.app.domain.repository.HabitRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HabitRepositoryImpl @Inject constructor(
    private val habitDao: HabitDao
) : HabitRepository {
    override fun getActiveHabits(): Flow<List<HabitEntity>> = habitDao.getActiveHabits()
    override fun getArchivedHabits(): Flow<List<HabitEntity>> = habitDao.getArchivedHabits()
    override fun getMetricsHabits(): Flow<List<HabitEntity>> = habitDao.getMetricsHabits()
    override fun getHabitById(habitId: Long): Flow<HabitEntity?> = habitDao.getHabitById(habitId)
    override suspend fun insertHabit(habit: HabitEntity): Long = habitDao.insertHabit(habit)
    override suspend fun updateHabit(habit: HabitEntity) = habitDao.updateHabit(habit)
    override suspend fun softDeleteHabit(habitId: Long) =
        habitDao.softDeleteHabit(habitId, System.currentTimeMillis())
    override suspend fun toggleHabitForDate(habitId: Long, date: String, completed: Boolean) =
        habitDao.toggleHabitForDate(habitId, date, completed)
    override suspend fun setHabitMissed(habitId: Long, date: String) =
        habitDao.setHabitMissed(habitId, date)
    override suspend fun archiveHabit(habitId: Long, archivedAt: Long) =
        habitDao.archiveHabit(habitId, archivedAt)

    override suspend fun unarchiveHabit(habitId: Long) =
        habitDao.unarchiveHabit(habitId)
}
