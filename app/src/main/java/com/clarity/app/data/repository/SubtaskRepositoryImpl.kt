package com.clarity.app.data.repository

import com.clarity.app.data.local.database.SubtaskDao
import com.clarity.app.data.local.database.SubtaskEntity
import com.clarity.app.domain.repository.SubtaskRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SubtaskRepositoryImpl @Inject constructor(
    private val subtaskDao: SubtaskDao
) : SubtaskRepository {

    override fun getSubtasksForTask(taskId: Long): Flow<List<SubtaskEntity>> {
        return subtaskDao.getSubtasksForTask(taskId)
    }

    override fun getSubtaskById(subtaskId: Long): Flow<SubtaskEntity?> {
        return subtaskDao.getSubtaskById(subtaskId)
    }

    override suspend fun insertSubtask(subtask: SubtaskEntity): Long {
        return subtaskDao.insertSubtask(subtask)
    }

    override suspend fun updateSubtask(subtask: SubtaskEntity) {
        subtaskDao.updateSubtask(subtask)
    }

    override suspend fun deleteSubtask(subtask: SubtaskEntity) {
        subtaskDao.deleteSubtask(subtask)
    }

    override suspend fun deleteSubtaskById(subtaskId: Long) {
        subtaskDao.deleteSubtaskById(subtaskId)
    }

    override suspend fun deleteAllSubtasksForTask(taskId: Long) {
        subtaskDao.deleteAllSubtasksForTask(taskId)
    }

    override suspend fun toggleSubtaskCompletion(subtaskId: Long, isCompleted: Boolean) {
        subtaskDao.toggleSubtaskCompletion(subtaskId, isCompleted)
    }
}
