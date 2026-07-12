package com.clarity.app.domain.repository

import com.clarity.app.data.local.database.SubtaskEntity
import kotlinx.coroutines.flow.Flow

interface SubtaskRepository {
    fun getSubtasksForTask(taskId: Long): Flow<List<SubtaskEntity>>
    fun getSubtaskById(subtaskId: Long): Flow<SubtaskEntity?>
    suspend fun insertSubtask(subtask: SubtaskEntity): Long
    suspend fun updateSubtask(subtask: SubtaskEntity)
    suspend fun deleteSubtask(subtask: SubtaskEntity)
    suspend fun deleteSubtaskById(subtaskId: Long)
    suspend fun deleteAllSubtasksForTask(taskId: Long)
    suspend fun toggleSubtaskCompletion(subtaskId: Long, isCompleted: Boolean)
}
