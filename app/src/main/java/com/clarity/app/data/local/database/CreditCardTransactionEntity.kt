package com.clarity.app.data.local.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "credit_card_transactions")
data class CreditCardTransactionEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val cardId: Long,
    val amount: Double,
    val description: String = "",
    val date: Long = System.currentTimeMillis(),
    val type: String,
    val createdAt: Long = System.currentTimeMillis()
)
