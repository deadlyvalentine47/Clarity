package com.clarity.app.data.local.database

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface NoteCategoryDao {
    @Query("SELECT * FROM note_categories ORDER BY name ASC")
    fun getAllCategories(): Flow<List<NoteCategoryEntity>>

    @Insert
    suspend fun insertCategory(category: NoteCategoryEntity): Long

    @Delete
    suspend fun deleteCategory(category: NoteCategoryEntity)

    @Query("DELETE FROM note_categories WHERE id = :categoryId")
    suspend fun deleteCategoryById(categoryId: Long)
}
