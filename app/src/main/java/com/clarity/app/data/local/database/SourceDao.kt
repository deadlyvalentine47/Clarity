package com.clarity.app.data.local.database

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface SourceDao {
    @Query("SELECT * FROM sources ORDER BY isDefault DESC, name ASC")
    fun getAllSources(): Flow<List<SourceEntity>>

    @Query("SELECT * FROM sources WHERE id = :sourceId")
    suspend fun getSourceById(sourceId: Long): SourceEntity?

    @Query("SELECT * FROM sources WHERE name = :name LIMIT 1")
    suspend fun getSourceByName(name: String): SourceEntity?

    @Insert
    suspend fun insertSource(source: SourceEntity): Long

    @Update
    suspend fun updateSource(source: SourceEntity)

    @Delete
    suspend fun deleteSource(source: SourceEntity)

    @Query("DELETE FROM sources WHERE id = :sourceId")
    suspend fun deleteSourceById(sourceId: Long)

    @Query("DELETE FROM sources")
    suspend fun deleteAllSources()
}
