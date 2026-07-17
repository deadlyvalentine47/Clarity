package com.clarity.app.domain.repository

import com.clarity.app.data.local.database.BudgetLimitEntity
import com.clarity.app.data.local.database.CategoryEntity
import com.clarity.app.data.local.database.SourceEntity
import com.clarity.app.data.local.database.TransactionEntity
import kotlinx.coroutines.flow.Flow

interface BudgetRepository {
    fun getAllTransactions(): Flow<List<TransactionEntity>>
    fun getTotalIncome(): Flow<Double?>
    fun getTotalExpenses(): Flow<Double?>
    fun getCategories(): Flow<List<CategoryEntity>>
    fun getSources(): Flow<List<SourceEntity>>
    fun getBudgetLimitsForMonth(month: Int, year: Int): Flow<List<BudgetLimitEntity>>
    suspend fun insertTransaction(transaction: TransactionEntity): Long
    suspend fun deleteTransaction(transaction: TransactionEntity)
    suspend fun insertCategory(category: CategoryEntity): Long
    suspend fun deleteCategory(category: CategoryEntity)
    suspend fun getSourceByName(name: String): SourceEntity?
    suspend fun insertSource(source: SourceEntity): Long
    suspend fun updateSource(source: SourceEntity)
    suspend fun deleteSource(source: SourceEntity)
    suspend fun insertBudgetLimit(budgetLimit: BudgetLimitEntity): Long
    suspend fun updateBudgetLimit(budgetLimit: BudgetLimitEntity)
    suspend fun deleteBudgetLimit(budgetLimit: BudgetLimitEntity)
}
