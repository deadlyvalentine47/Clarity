package com.clarity.app.domain.repository

import com.clarity.app.data.local.database.TransactionEntity
import kotlinx.coroutines.flow.Flow

interface TransactionRepository {
    fun getAllTransactions(): Flow<List<TransactionEntity>>
    fun getExpenses(): Flow<List<TransactionEntity>>
    fun getIncome(): Flow<List<TransactionEntity>>
    fun getTotalIncome(): Flow<Double?>
    fun getTotalExpenses(): Flow<Double?>
    fun getTransactionsByCategory(category: String): Flow<List<TransactionEntity>>
    fun getTransactionsBySource(source: String): Flow<List<TransactionEntity>>
    fun getTransactionsByDateRange(start: Long, end: Long): Flow<List<TransactionEntity>>
    fun getTransactionById(transactionId: Long): Flow<TransactionEntity?>
    suspend fun insertTransaction(transaction: TransactionEntity): Long
    suspend fun updateTransaction(transaction: TransactionEntity)
    suspend fun deleteTransaction(transaction: TransactionEntity)
}
