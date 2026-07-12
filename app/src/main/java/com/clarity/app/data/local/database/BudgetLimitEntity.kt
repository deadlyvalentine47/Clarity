package com.clarity.app.data.local.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "budget_limits")
data class BudgetLimitEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val category: String,
    val limitAmount: Double,
    val month: Int, // 1-12
    val year: Int,
    val createdAt: Long = System.currentTimeMillis()
)
