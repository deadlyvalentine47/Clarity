package com.clarity.app.data.local.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "investments")
data class InvestmentEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,
    val type: String,
    val units: Double,
    val purchasePrice: Double,
    val currentPrice: Double,
    val purchaseDate: Long,
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis()
)
