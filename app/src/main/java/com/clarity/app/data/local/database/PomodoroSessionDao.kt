package com.clarity.app.data.local.database

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface PomodoroSessionDao {
    @Query("SELECT * FROM pomodoro_sessions ORDER BY completedAt DESC")
    fun getAllSessions(): Flow<List<PomodoroSessionEntity>>

    @Query("SELECT * FROM pomodoro_sessions WHERE completedAt BETWEEN :startOfDay AND :endOfDay")
    fun getSessionsForDay(startOfDay: Long, endOfDay: Long): Flow<List<PomodoroSessionEntity>>

    @Query("SELECT SUM(duration) FROM pomodoro_sessions WHERE type = 'Focus' AND completedAt BETWEEN :startOfDay AND :endOfDay")
    fun getFocusTimeForDay(startOfDay: Long, endOfDay: Long): Flow<Int?>

    @Insert
    suspend fun insertSession(session: PomodoroSessionEntity): Long

    @Delete
    suspend fun deleteSession(session: PomodoroSessionEntity)

    @Query("DELETE FROM pomodoro_sessions")
    suspend fun deleteAllSessions()
}
