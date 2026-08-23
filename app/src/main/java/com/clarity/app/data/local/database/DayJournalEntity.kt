package com.clarity.app.data.local.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "day_journals")
data class DayJournalEntity(
    @PrimaryKey
    val date: String, // "YYYY-MM-DD"
    val content: String = "",
    val updatedAt: Long = System.currentTimeMillis()
)
