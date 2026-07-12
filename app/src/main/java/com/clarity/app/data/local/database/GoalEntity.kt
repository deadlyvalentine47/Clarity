package com.clarity.app.data.local.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "goals")
data class GoalEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val title: String,
    val description: String = "",
    val type: String = "Short-term", // Short-term, Long-term
    val progress: Float = 0f, // 0.0 to 1.0
    val targetDate: Long? = null,
    val milestones: List<String> = emptyList(),
    val completedMilestones: List<String> = emptyList(),
    val isCompleted: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)
