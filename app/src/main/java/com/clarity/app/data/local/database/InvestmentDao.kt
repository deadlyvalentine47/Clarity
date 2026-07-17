package com.clarity.app.data.local.database

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface InvestmentDao {
    @Query("SELECT * FROM investments ORDER BY purchaseDate DESC")
    fun getAllInvestments(): Flow<List<InvestmentEntity>>

    @Query("SELECT * FROM investments WHERE type = :type ORDER BY purchaseDate DESC")
    fun getInvestmentsByType(type: String): Flow<List<InvestmentEntity>>

    @Query("SELECT * FROM investments WHERE id = :id")
    fun getInvestmentById(id: Long): Flow<InvestmentEntity?>

    @Insert
    suspend fun insertInvestment(investment: InvestmentEntity): Long

    @Update
    suspend fun updateInvestment(investment: InvestmentEntity)

    @Delete
    suspend fun deleteInvestment(investment: InvestmentEntity)

    @Query("DELETE FROM investments")
    suspend fun deleteAllInvestments()
}
