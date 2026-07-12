package com.clarity.app.data.repository

import com.clarity.app.data.local.database.TaskDao
import com.clarity.app.data.local.database.TaskEntity
import com.clarity.app.domain.repository.TaskRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TaskRepositoryImpl @Inject constructor(
    private val taskDao: TaskDao
) : TaskRepository {

    override fun getAllTasks(): Flow<List<TaskEntity>> = taskDao.getAllTasks()

    override fun getPendingTasks(): Flow<List<TaskEntity>> = taskDao.getPendingTasks()

    override fun getCompletedTasks(): Flow<List<TaskEntity>> = taskDao.getCompletedTasks()

    override fun getOverdueTasks(): Flow<List<TaskEntity>> = taskDao.getOverdueTasks(System.currentTimeMillis())

    override fun getTodayTasks(startOfDay: Long, endOfDay: Long): Flow<List<TaskEntity>> =
        taskDao.getTodayTasks(startOfDay, endOfDay)

    override fun getTasksByPriority(priority: String): Flow<List<TaskEntity>> =
        taskDao.getTasksByPriority(priority)

    override fun getTasksByCategory(category: String): Flow<List<TaskEntity>> =
        taskDao.getTasksByCategory(category)

    override fun searchTasks(query: String): Flow<List<TaskEntity>> =
        taskDao.searchTasks("%$query%")

    override fun getTaskById(taskId: Long): Flow<TaskEntity?> = taskDao.getTaskById(taskId)

    override suspend fun insertTask(task: TaskEntity): Long = taskDao.insertTask(task)

    override suspend fun updateTask(task: TaskEntity) = taskDao.updateTask(task)

    override suspend fun deleteTask(task: TaskEntity) = taskDao.deleteTask(task)

    override suspend fun toggleTaskCompletion(taskId: Long, isCompleted: Boolean) {
        taskDao.toggleTaskCompletion(taskId, isCompleted, System.currentTimeMillis())
    }
}
