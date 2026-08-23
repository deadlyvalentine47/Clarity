package com.clarity.app.domain.repository

import com.clarity.app.data.local.database.NoteCategoryEntity
import com.clarity.app.data.local.database.NoteEntity
import kotlinx.coroutines.flow.Flow

interface NoteRepository {
    fun getAllNotes(): Flow<List<NoteEntity>>
    fun getPinnedNotes(): Flow<List<NoteEntity>>
    fun getNoteById(noteId: Long): Flow<NoteEntity?>
    suspend fun insertNote(note: NoteEntity): Long
    suspend fun updateNote(note: NoteEntity)
    suspend fun deleteNote(note: NoteEntity)
    suspend fun deleteNoteWithDescendants(noteId: Long)
    suspend fun setParentNote(noteId: Long, parentId: Long?)
    suspend fun setSortOrder(noteId: Long, sortOrder: Int)

    fun getAllCategories(): Flow<List<NoteCategoryEntity>>
    suspend fun insertCategory(category: NoteCategoryEntity): Long
    suspend fun deleteCategory(category: NoteCategoryEntity)
}
