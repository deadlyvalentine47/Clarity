package com.clarity.app.data.local.database

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface CreditCardDao {
    @Query("SELECT * FROM credit_cards ORDER BY createdAt DESC")
    fun getAllCards(): Flow<List<CreditCardEntity>>

    @Query("SELECT * FROM credit_cards WHERE id = :cardId")
    fun getCardById(cardId: Long): Flow<CreditCardEntity?>

    @Query("SELECT * FROM credit_cards WHERE name = :name LIMIT 1")
    suspend fun getCardByName(name: String): CreditCardEntity?

    @Insert
    suspend fun insertCard(card: CreditCardEntity): Long

    @Update
    suspend fun updateCard(card: CreditCardEntity)

    @Delete
    suspend fun deleteCard(card: CreditCardEntity)

    @Query("DELETE FROM credit_cards")
    suspend fun deleteAllCards()
}
