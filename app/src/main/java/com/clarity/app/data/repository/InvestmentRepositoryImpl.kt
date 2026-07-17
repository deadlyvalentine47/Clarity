package com.clarity.app.data.repository

import com.clarity.app.data.local.database.InvestmentDao
import com.clarity.app.data.local.database.InvestmentEntity
import com.clarity.app.domain.repository.InvestmentRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class InvestmentRepositoryImpl @Inject constructor(
    private val investmentDao: InvestmentDao
) : InvestmentRepository {

    override fun getAllInvestments(): Flow<List<InvestmentEntity>> = investmentDao.getAllInvestments()

    override fun getInvestmentsByType(type: String): Flow<List<InvestmentEntity>> =
        investmentDao.getInvestmentsByType(type)

    override fun getInvestmentById(id: Long): Flow<InvestmentEntity?> = investmentDao.getInvestmentById(id)

    override suspend fun insertInvestment(investment: InvestmentEntity): Long =
        investmentDao.insertInvestment(investment)

    override suspend fun updateInvestment(investment: InvestmentEntity) =
        investmentDao.updateInvestment(investment)

    override suspend fun deleteInvestment(investment: InvestmentEntity) =
        investmentDao.deleteInvestment(investment)
}
