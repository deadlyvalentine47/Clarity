package com.clarity.app.data.local.database

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface BudgetLimitDao {
    @Query("SELECT * FROM budget_limits WHERE month = :month AND year = :year")
    fun getBudgetLimitsForMonth(month: Int, year: Int): Flow<List<BudgetLimitEntity>>

    @Query("SELECT * FROM budget_limits WHERE category = :category AND month = :month AND year = :year")
    fun getBudgetLimitForCategory(category: String, month: Int, year: Int): Flow<BudgetLimitEntity?>

    @Insert
    suspend fun insertBudgetLimit(budgetLimit: BudgetLimitEntity): Long

    @Update
    suspend fun updateBudgetLimit(budgetLimit: BudgetLimitEntity)

    @Delete
    suspend fun deleteBudgetLimit(budgetLimit: BudgetLimitEntity)

    @Query("DELETE FROM budget_limits WHERE id = :budgetLimitId")
    suspend fun deleteBudgetLimitById(budgetLimitId: Long)
}
