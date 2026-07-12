package com.clarity.app.domain.repository

import com.clarity.app.data.local.database.TaskEntity
import kotlinx.coroutines.flow.Flow

interface TaskRepository {
    fun getAllTasks(): Flow<List<TaskEntity>>
    fun getPendingTasks(): Flow<List<TaskEntity>>
    fun getCompletedTasks(): Flow<List<TaskEntity>>
    fun getOverdueTasks(): Flow<List<TaskEntity>>
    fun getTodayTasks(startOfDay: Long, endOfDay: Long): Flow<List<TaskEntity>>
    fun getTasksByPriority(priority: String): Flow<List<TaskEntity>>
    fun getTasksByCategory(category: String): Flow<List<TaskEntity>>
    fun searchTasks(query: String): Flow<List<TaskEntity>>
    fun getTaskById(taskId: Long): Flow<TaskEntity?>
    suspend fun insertTask(task: TaskEntity): Long
    suspend fun updateTask(task: TaskEntity)
    suspend fun deleteTask(task: TaskEntity)
    suspend fun toggleTaskCompletion(taskId: Long, isCompleted: Boolean)
}
