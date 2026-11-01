package com.clarity.app.domain.repository

import com.clarity.app.data.local.database.PomodoroFocusSessionEntity
import com.clarity.app.data.local.database.PomodoroSessionEntity
import kotlinx.coroutines.flow.Flow

interface PomodoroRepository {
    // Focus sessions
    fun getAllFocusSessions(): Flow<List<PomodoroFocusSessionEntity>>
    fun getFocusSessionById(id: Long): Flow<PomodoroFocusSessionEntity?>
    fun searchFocusSessions(query: String): Flow<List<PomodoroFocusSessionEntity>>
    suspend fun insertFocusSession(session: PomodoroFocusSessionEntity): Long
    suspend fun updateFocusSession(session: PomodoroFocusSessionEntity)
    suspend fun deleteFocusSession(session: PomodoroFocusSessionEntity)

    // Timer sessions
    fun getAllTimerSessions(): Flow<List<PomodoroSessionEntity>>
    fun getTimerSessionsForDay(startOfDay: Long, endOfDay: Long): Flow<List<PomodoroSessionEntity>>
    fun getFocusTimeForDay(startOfDay: Long, endOfDay: Long): Flow<Int?>
    suspend fun insertTimerSession(session: PomodoroSessionEntity): Long
    suspend fun deleteTimerSession(session: PomodoroSessionEntity)
}
