package com.clarity.app.data.local.database

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface EventDao {
    @Query("SELECT * FROM events ORDER BY startDate ASC")
    fun getAllEvents(): Flow<List<EventEntity>>

    @Query("SELECT * FROM events WHERE startDate BETWEEN :startOfDay AND :endOfDay")
    fun getEventsForDay(startOfDay: Long, endOfDay: Long): Flow<List<EventEntity>>

    @Query("SELECT * FROM events WHERE startDate BETWEEN :startOfWeek AND :endOfWeek")
    fun getEventsForWeek(startOfWeek: Long, endOfWeek: Long): Flow<List<EventEntity>>

    @Query("SELECT * FROM events WHERE id = :eventId")
    fun getEventById(eventId: Long): Flow<EventEntity?>

    @Insert
    suspend fun insertEvent(event: EventEntity): Long

    @Update
    suspend fun updateEvent(event: EventEntity)

    @Delete
    suspend fun deleteEvent(event: EventEntity)
}
