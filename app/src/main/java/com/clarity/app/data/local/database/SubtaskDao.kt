package com.clarity.app.data.local.database

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface SubtaskDao {
    @Query("SELECT * FROM subtasks WHERE taskId = :taskId ORDER BY createdAt ASC")
    fun getSubtasksForTask(taskId: Long): Flow<List<SubtaskEntity>>

    @Query("SELECT * FROM subtasks WHERE id = :subtaskId")
    fun getSubtaskById(subtaskId: Long): Flow<SubtaskEntity?>

    @Insert
    suspend fun insertSubtask(subtask: SubtaskEntity): Long

    @Update
    suspend fun updateSubtask(subtask: SubtaskEntity)

    @Delete
    suspend fun deleteSubtask(subtask: SubtaskEntity)

    @Query("DELETE FROM subtasks WHERE id = :subtaskId")
    suspend fun deleteSubtaskById(subtaskId: Long)

    @Query("DELETE FROM subtasks WHERE taskId = :taskId")
    suspend fun deleteAllSubtasksForTask(taskId: Long)

    @Query("UPDATE subtasks SET isCompleted = :isCompleted WHERE id = :subtaskId")
    suspend fun toggleSubtaskCompletion(subtaskId: Long, isCompleted: Boolean)
}
