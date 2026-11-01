package com.clarity.app.data.local.database

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface PomodoroFocusSessionDao {
    @Query("SELECT * FROM pomodoro_focus_sessions ORDER BY updatedAt DESC")
    fun getAllSessions(): Flow<List<PomodoroFocusSessionEntity>>

    @Query("SELECT * FROM pomodoro_focus_sessions WHERE id = :id")
    fun getSessionById(id: Long): Flow<PomodoroFocusSessionEntity?>

    @Query("SELECT * FROM pomodoro_focus_sessions WHERE title LIKE '%' || :query || '%' ORDER BY updatedAt DESC")
    fun searchSessions(query: String): Flow<List<PomodoroFocusSessionEntity>>

    @Insert
    suspend fun insertSession(session: PomodoroFocusSessionEntity): Long

    @Update
    suspend fun updateSession(session: PomodoroFocusSessionEntity)

    @Delete
    suspend fun deleteSession(session: PomodoroFocusSessionEntity)

    @Query("DELETE FROM pomodoro_focus_sessions")
    suspend fun deleteAllSessions()
}
