package com.clarity.app.data.local.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "credit_cards")
data class CreditCardEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,
    val creditLimit: Double,
    val billingCycleDay: Int,
    val createdAt: Long = System.currentTimeMillis()
)
