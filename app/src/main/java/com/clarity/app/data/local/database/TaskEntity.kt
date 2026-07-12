package com.clarity.app.data.local.database

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverters

@Entity(tableName = "tasks")
@TypeConverters(Converters::class)
data class TaskEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val title: String,
    val description: String = "",
    val priority: String = "Medium", // High, Medium, Low
    val category: String = "",
    val tags: List<String> = emptyList(),
    val dueDate: Long? = null,
    val reminderTime: Long? = null,
    val isCompleted: Boolean = false,
    val isRecurring: Boolean = false,
    val recurringType: String? = null, // Daily, Weekly, Monthly, Custom
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
