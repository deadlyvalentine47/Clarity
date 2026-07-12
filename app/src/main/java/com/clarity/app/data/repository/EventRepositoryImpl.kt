package com.clarity.app.data.repository

import com.clarity.app.data.local.database.EventDao
import com.clarity.app.data.local.database.EventEntity
import com.clarity.app.domain.repository.EventRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class EventRepositoryImpl @Inject constructor(
    private val eventDao: EventDao
) : EventRepository {
    override fun getAllEvents(): Flow<List<EventEntity>> = eventDao.getAllEvents()
    override fun getEventsForDay(startOfDay: Long, endOfDay: Long): Flow<List<EventEntity>> = eventDao.getEventsForDay(startOfDay, endOfDay)
    override fun getEventsForWeek(startOfWeek: Long, endOfWeek: Long): Flow<List<EventEntity>> = eventDao.getEventsForWeek(startOfWeek, endOfWeek)
    override fun getEventById(eventId: Long): Flow<EventEntity?> = eventDao.getEventById(eventId)
    override suspend fun insertEvent(event: EventEntity): Long = eventDao.insertEvent(event)
    override suspend fun updateEvent(event: EventEntity) = eventDao.updateEvent(event)
    override suspend fun deleteEvent(event: EventEntity) = eventDao.deleteEvent(event)
}
