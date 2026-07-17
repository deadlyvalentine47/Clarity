package com.clarity.app.domain.repository

import com.clarity.app.data.local.database.CreditCardEntity
import com.clarity.app.data.local.database.CreditCardTransactionEntity
import kotlinx.coroutines.flow.Flow

interface CreditCardRepository {
    fun getAllCards(): Flow<List<CreditCardEntity>>
    fun getCardById(cardId: Long): Flow<CreditCardEntity?>
    suspend fun getCardByName(name: String): CreditCardEntity?
    suspend fun insertCard(card: CreditCardEntity): Long
    suspend fun updateCard(card: CreditCardEntity)
    suspend fun deleteCard(card: CreditCardEntity)

    fun getTransactionsForCard(cardId: Long): Flow<List<CreditCardTransactionEntity>>
    fun getTransactionsForCardInRange(cardId: Long, start: Long, end: Long): Flow<List<CreditCardTransactionEntity>>
    fun getOutstandingForCard(cardId: Long): Flow<Double?>
    fun getOutstandingForCardInRange(cardId: Long, start: Long, end: Long): Flow<Double?>
    suspend fun insertTransaction(transaction: CreditCardTransactionEntity): Long
    suspend fun deleteTransaction(transaction: CreditCardTransactionEntity)
}
