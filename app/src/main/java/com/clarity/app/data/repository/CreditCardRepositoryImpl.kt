package com.clarity.app.data.repository

import com.clarity.app.data.local.database.CreditCardDao
import com.clarity.app.data.local.database.CreditCardEntity
import com.clarity.app.data.local.database.CreditCardTransactionDao
import com.clarity.app.data.local.database.CreditCardTransactionEntity
import com.clarity.app.domain.repository.CreditCardRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CreditCardRepositoryImpl @Inject constructor(
    private val creditCardDao: CreditCardDao,
    private val creditCardTransactionDao: CreditCardTransactionDao
) : CreditCardRepository {

    override fun getAllCards(): Flow<List<CreditCardEntity>> = creditCardDao.getAllCards()

    override fun getCardById(cardId: Long): Flow<CreditCardEntity?> = creditCardDao.getCardById(cardId)

    override suspend fun getCardByName(name: String): CreditCardEntity? = creditCardDao.getCardByName(name)

    override suspend fun insertCard(card: CreditCardEntity): Long = creditCardDao.insertCard(card)

    override suspend fun updateCard(card: CreditCardEntity) = creditCardDao.updateCard(card)

    override suspend fun deleteCard(card: CreditCardEntity) = creditCardDao.deleteCard(card)

    override fun getTransactionsForCard(cardId: Long): Flow<List<CreditCardTransactionEntity>> =
        creditCardTransactionDao.getTransactionsForCard(cardId)

    override fun getTransactionsForCardInRange(cardId: Long, start: Long, end: Long): Flow<List<CreditCardTransactionEntity>> =
        creditCardTransactionDao.getTransactionsForCardInRange(cardId, start, end)

    override fun getOutstandingForCard(cardId: Long): Flow<Double?> =
        creditCardTransactionDao.getOutstandingForCard(cardId)

    override fun getOutstandingForCardInRange(cardId: Long, start: Long, end: Long): Flow<Double?> =
        creditCardTransactionDao.getOutstandingForCardInRange(cardId, start, end)

    override suspend fun insertTransaction(transaction: CreditCardTransactionEntity): Long =
        creditCardTransactionDao.insertTransaction(transaction)

    override suspend fun deleteTransaction(transaction: CreditCardTransactionEntity) =
        creditCardTransactionDao.deleteTransaction(transaction)

    override suspend fun getAllTransactions(): List<CreditCardTransactionEntity> =
        creditCardTransactionDao.getAllTransactions()
}
