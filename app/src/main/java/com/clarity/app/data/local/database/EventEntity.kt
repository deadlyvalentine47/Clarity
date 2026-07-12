package com.clarity.app.data.local.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "events")
data class EventEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val title: String,
    val description: String = "",
    val startDate: Long,
    val endDate: Long,
    val category: String = "",
    val color: String = "#4A90D9",
    val isAllDay: Boolean = false,
    val reminderTime: Long? = null,
    val createdAt: Long = System.currentTimeMillis()
)
