package com.clarity.app.domain.repository

import com.clarity.app.data.local.database.EventEntity
import kotlinx.coroutines.flow.Flow

interface EventRepository {
    fun getAllEvents(): Flow<List<EventEntity>>
    fun getEventsForDay(startOfDay: Long, endOfDay: Long): Flow<List<EventEntity>>
    fun getEventsForWeek(startOfWeek: Long, endOfWeek: Long): Flow<List<EventEntity>>
    fun getEventById(eventId: Long): Flow<EventEntity?>
    suspend fun insertEvent(event: EventEntity): Long
    suspend fun updateEvent(event: EventEntity)
    suspend fun deleteEvent(event: EventEntity)
}
