package com.clarity.app.data.repository

import com.clarity.app.data.local.database.GoalDao
import com.clarity.app.data.local.database.GoalEntity
import com.clarity.app.domain.repository.GoalRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GoalRepositoryImpl @Inject constructor(
    private val goalDao: GoalDao
) : GoalRepository {
    override fun getActiveGoals(): Flow<List<GoalEntity>> = goalDao.getActiveGoals()
    override fun getCompletedGoals(): Flow<List<GoalEntity>> = goalDao.getCompletedGoals()
    override fun getGoalById(goalId: Long): Flow<GoalEntity?> = goalDao.getGoalById(goalId)
    override suspend fun insertGoal(goal: GoalEntity): Long = goalDao.insertGoal(goal)
    override suspend fun updateGoal(goal: GoalEntity) = goalDao.updateGoal(goal)
    override suspend fun deleteGoal(goal: GoalEntity) = goalDao.deleteGoal(goal)
}
