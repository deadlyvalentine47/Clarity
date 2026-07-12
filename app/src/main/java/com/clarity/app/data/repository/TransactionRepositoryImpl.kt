package com.clarity.app.data.repository

import com.clarity.app.data.local.database.TransactionDao
import com.clarity.app.data.local.database.TransactionEntity
import com.clarity.app.domain.repository.TransactionRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TransactionRepositoryImpl @Inject constructor(
    private val transactionDao: TransactionDao
) : TransactionRepository {

    override fun getAllTransactions(): Flow<List<TransactionEntity>> = transactionDao.getAllTransactions()

    override fun getExpenses(): Flow<List<TransactionEntity>> = transactionDao.getExpenses()

    override fun getIncome(): Flow<List<TransactionEntity>> = transactionDao.getIncome()

    override fun getTotalIncome(): Flow<Double?> = transactionDao.getTotalIncome()

    override fun getTotalExpenses(): Flow<Double?> = transactionDao.getTotalExpenses()

    override fun getTransactionsByCategory(category: String): Flow<List<TransactionEntity>> =
        transactionDao.getTransactionsByCategory(category)

    override fun getTransactionsBySource(source: String): Flow<List<TransactionEntity>> =
        transactionDao.getTransactionsBySource(source)

    override fun getTransactionsByDateRange(start: Long, end: Long): Flow<List<TransactionEntity>> =
        transactionDao.getTransactionsByDateRange(start, end)

    override fun getTransactionById(transactionId: Long): Flow<TransactionEntity?> =
        transactionDao.getTransactionById(transactionId)

    override suspend fun insertTransaction(transaction: TransactionEntity): Long =
        transactionDao.insertTransaction(transaction)

    override suspend fun updateTransaction(transaction: TransactionEntity) =
        transactionDao.updateTransaction(transaction)

    override suspend fun deleteTransaction(transaction: TransactionEntity) =
        transactionDao.deleteTransaction(transaction)
}
