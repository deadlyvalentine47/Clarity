package com.clarity.app.domain.repository

import com.clarity.app.data.local.database.GoalEntity
import kotlinx.coroutines.flow.Flow

interface GoalRepository {
    fun getActiveGoals(): Flow<List<GoalEntity>>
    fun getCompletedGoals(): Flow<List<GoalEntity>>
    fun getGoalById(goalId: Long): Flow<GoalEntity?>
    suspend fun insertGoal(goal: GoalEntity): Long
    suspend fun updateGoal(goal: GoalEntity)
    suspend fun deleteGoal(goal: GoalEntity)
}
