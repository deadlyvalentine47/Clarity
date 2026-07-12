package com.clarity.app.data.local.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "transactions")
data class TransactionEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val type: String, // Income, Expense
    val amount: Double,
    val category: String,
    val source: String = "",
    val description: String = "",
    val date: Long = System.currentTimeMillis(),
    val isRecurring: Boolean = false,
    val recurringType: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)
