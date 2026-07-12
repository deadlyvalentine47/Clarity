package com.clarity.app.data.local.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "habits")
data class HabitEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,
    val description: String = "",
    val frequency: String = "Daily", // Daily, Weekly, Monthly
    val targetCount: Int = 1,
    val currentStreak: Int = 0,
    val bestStreak: Int = 0,
    val completionHistory: Map<String, Boolean> = emptyMap(), // date to completed
    val reminderTime: Long? = null,
    val isArchived: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)
