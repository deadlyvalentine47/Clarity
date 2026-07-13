package com.clarity.app.data.repository

import com.clarity.app.data.local.database.PomodoroFocusSessionDao
import com.clarity.app.data.local.database.PomodoroFocusSessionEntity
import com.clarity.app.data.local.database.PomodoroSessionDao
import com.clarity.app.data.local.database.PomodoroSessionEntity
import com.clarity.app.domain.repository.PomodoroRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PomodoroRepositoryImpl @Inject constructor(
    private val focusSessionDao: PomodoroFocusSessionDao,
    private val sessionDao: PomodoroSessionDao
) : PomodoroRepository {

    override fun getAllFocusSessions(): Flow<List<PomodoroFocusSessionEntity>> = focusSessionDao.getAllSessions()

    override fun getFocusSessionById(id: Long): Flow<PomodoroFocusSessionEntity?> = focusSessionDao.getSessionById(id)

    override fun searchFocusSessions(query: String): Flow<List<PomodoroFocusSessionEntity>> = focusSessionDao.searchSessions(query)

    override suspend fun insertFocusSession(session: PomodoroFocusSessionEntity): Long = focusSessionDao.insertSession(session)

    override suspend fun updateFocusSession(session: PomodoroFocusSessionEntity) = focusSessionDao.updateSession(session)

    override suspend fun deleteFocusSession(session: PomodoroFocusSessionEntity) = focusSessionDao.deleteSession(session)

    override fun getAllTimerSessions(): Flow<List<PomodoroSessionEntity>> = sessionDao.getAllSessions()

    override fun getTimerSessionsForDay(startOfDay: Long, endOfDay: Long): Flow<List<PomodoroSessionEntity>> =
        sessionDao.getSessionsForDay(startOfDay, endOfDay)

    override fun getFocusTimeForDay(startOfDay: Long, endOfDay: Long): Flow<Int?> =
        sessionDao.getFocusTimeForDay(startOfDay, endOfDay)

    override suspend fun insertTimerSession(session: PomodoroSessionEntity): Long = sessionDao.insertSession(session)

    override suspend fun deleteTimerSession(session: PomodoroSessionEntity) = sessionDao.deleteSession(session)
}
