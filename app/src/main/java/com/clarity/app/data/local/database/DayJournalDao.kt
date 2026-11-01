package com.clarity.app.data.local.database

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface DayJournalDao {
    @Query("SELECT * FROM day_journals WHERE date = :date")
    fun getJournal(date: String): Flow<DayJournalEntity?>

    @Query("SELECT * FROM day_journals WHERE date = :date")
    suspend fun getJournalOnce(date: String): DayJournalEntity?

    @Query("SELECT * FROM day_journals")
    fun getAllJournals(): Flow<List<DayJournalEntity>>

    @Upsert
    suspend fun upsertJournal(journal: DayJournalEntity)

    @Query("DELETE FROM day_journals")
    suspend fun deleteAll()
}
