package com.clarity.app.data.local.database

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CreditCardTransactionDao {
    @Query("SELECT * FROM credit_card_transactions WHERE cardId = :cardId ORDER BY date DESC")
    fun getTransactionsForCard(cardId: Long): Flow<List<CreditCardTransactionEntity>>

    @Query("SELECT * FROM credit_card_transactions WHERE cardId = :cardId AND date BETWEEN :start AND :end ORDER BY date DESC")
    fun getTransactionsForCardInRange(cardId: Long, start: Long, end: Long): Flow<List<CreditCardTransactionEntity>>

    @Query("SELECT SUM(CASE WHEN type = 'Purchase' THEN amount ELSE 0 END) - SUM(CASE WHEN type IN ('Payment', 'Credit') THEN amount ELSE 0 END) FROM credit_card_transactions WHERE cardId = :cardId")
    fun getOutstandingForCard(cardId: Long): Flow<Double?>

    @Query("SELECT SUM(CASE WHEN type = 'Purchase' THEN amount ELSE 0 END) - SUM(CASE WHEN type IN ('Payment', 'Credit') THEN amount ELSE 0 END) FROM credit_card_transactions WHERE cardId = :cardId AND date BETWEEN :start AND :end")
    fun getOutstandingForCardInRange(cardId: Long, start: Long, end: Long): Flow<Double?>

    @Query("SELECT * FROM credit_card_transactions ORDER BY date DESC")
    suspend fun getAllTransactions(): List<CreditCardTransactionEntity>

    @Insert
    suspend fun insertTransaction(transaction: CreditCardTransactionEntity): Long

    @Delete
    suspend fun deleteTransaction(transaction: CreditCardTransactionEntity)

    @Query("DELETE FROM credit_card_transactions")
    suspend fun deleteAllTransactions()
}
