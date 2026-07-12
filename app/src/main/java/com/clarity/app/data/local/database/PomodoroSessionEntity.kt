package com.clarity.app.data.local.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pomodoro_sessions")
data class PomodoroSessionEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val taskId: Long? = null,
    val duration: Int, // in minutes
    val type: String, // Focus, ShortBreak, LongBreak
    val completedAt: Long = System.currentTimeMillis(),
    val distractions: List<String> = emptyList()
)
