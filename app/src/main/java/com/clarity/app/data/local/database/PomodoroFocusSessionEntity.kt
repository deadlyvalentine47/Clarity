package com.clarity.app.data.local.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pomodoro_focus_sessions")
data class PomodoroFocusSessionEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val title: String,
    val focusDurationMinutes: Int = 25,
    val breakDurationMinutes: Int = 5,
    val sessionCount: Int = 0,
    val totalFocusMinutes: Int = 0,
    val distractions: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
