package com.clarity.app.domain.repository

import com.clarity.app.data.local.database.InvestmentEntity
import kotlinx.coroutines.flow.Flow

interface InvestmentRepository {
    fun getAllInvestments(): Flow<List<InvestmentEntity>>
    fun getInvestmentsByType(type: String): Flow<List<InvestmentEntity>>
    fun getInvestmentById(id: Long): Flow<InvestmentEntity?>
    suspend fun insertInvestment(investment: InvestmentEntity): Long
    suspend fun updateInvestment(investment: InvestmentEntity)
    suspend fun deleteInvestment(investment: InvestmentEntity)
}
