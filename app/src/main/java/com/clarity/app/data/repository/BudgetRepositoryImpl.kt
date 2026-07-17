package com.clarity.app.data.repository

import com.clarity.app.data.local.database.BudgetLimitDao
import com.clarity.app.data.local.database.BudgetLimitEntity
import com.clarity.app.data.local.database.CategoryDao
import com.clarity.app.data.local.database.CategoryEntity
import com.clarity.app.data.local.database.SourceDao
import com.clarity.app.data.local.database.SourceEntity
import com.clarity.app.data.local.database.TransactionEntity
import com.clarity.app.domain.repository.BudgetRepository
import com.clarity.app.domain.repository.TransactionRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BudgetRepositoryImpl @Inject constructor(
    private val transactionRepository: TransactionRepository,
    private val budgetLimitDao: BudgetLimitDao,
    private val categoryDao: CategoryDao,
    private val sourceDao: SourceDao
) : BudgetRepository {

    override fun getAllTransactions(): Flow<List<TransactionEntity>> = transactionRepository.getAllTransactions()

    override fun getTotalIncome(): Flow<Double?> = transactionRepository.getTotalIncome()

    override fun getTotalExpenses(): Flow<Double?> = transactionRepository.getTotalExpenses()

    override fun getCategories(): Flow<List<CategoryEntity>> = categoryDao.getAllCategories()

    override fun getSources(): Flow<List<SourceEntity>> = sourceDao.getAllSources()

    override fun getBudgetLimitsForMonth(month: Int, year: Int): Flow<List<BudgetLimitEntity>> =
        budgetLimitDao.getBudgetLimitsForMonth(month, year)

    override suspend fun insertTransaction(transaction: TransactionEntity): Long {
        return transactionRepository.insertTransaction(transaction)
    }

    override suspend fun deleteTransaction(transaction: TransactionEntity) {
        transactionRepository.deleteTransaction(transaction)
    }

    override suspend fun insertCategory(category: CategoryEntity): Long = categoryDao.insertCategory(category)

    override suspend fun deleteCategory(category: CategoryEntity) = categoryDao.deleteCategory(category)

    override suspend fun getSourceByName(name: String): SourceEntity? = sourceDao.getSourceByName(name)

    override suspend fun insertSource(source: SourceEntity): Long = sourceDao.insertSource(source)

    override suspend fun updateSource(source: SourceEntity) = sourceDao.updateSource(source)

    override suspend fun deleteSource(source: SourceEntity) = sourceDao.deleteSource(source)

    override suspend fun insertBudgetLimit(budgetLimit: BudgetLimitEntity) = budgetLimitDao.insertBudgetLimit(budgetLimit)

    override suspend fun updateBudgetLimit(budgetLimit: BudgetLimitEntity) = budgetLimitDao.updateBudgetLimit(budgetLimit)

    override suspend fun deleteBudgetLimit(budgetLimit: BudgetLimitEntity) = budgetLimitDao.deleteBudgetLimit(budgetLimit)
}
