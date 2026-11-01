package com.clarity.app.data.repository

import com.clarity.app.data.local.database.NoteCategoryDao
import com.clarity.app.data.local.database.NoteCategoryEntity
import com.clarity.app.data.local.database.NoteDao
import com.clarity.app.data.local.database.NoteEntity
import com.clarity.app.domain.repository.NoteRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NoteRepositoryImpl @Inject constructor(
    private val noteDao: NoteDao,
    private val noteCategoryDao: NoteCategoryDao
) : NoteRepository {
    override fun getAllNotes(): Flow<List<NoteEntity>> = noteDao.getAllNotes()
    override fun getPinnedNotes(): Flow<List<NoteEntity>> = noteDao.getPinnedNotes()
    override fun getNoteById(noteId: Long): Flow<NoteEntity?> = noteDao.getNoteById(noteId)
    override suspend fun insertNote(note: NoteEntity): Long = noteDao.insertNote(note)
    override suspend fun updateNote(note: NoteEntity) = noteDao.updateNote(note)
    override suspend fun deleteNote(note: NoteEntity) = noteDao.deleteNote(note)
    override suspend fun deleteNoteWithDescendants(noteId: Long) = noteDao.deleteNoteWithDescendants(noteId)
    override suspend fun setParentNote(noteId: Long, parentId: Long?) = noteDao.setParentNote(noteId, parentId)
    override suspend fun setSortOrder(noteId: Long, sortOrder: Int) = noteDao.setSortOrder(noteId, sortOrder)

    override fun getAllCategories(): Flow<List<NoteCategoryEntity>> = noteCategoryDao.getAllCategories()
    override suspend fun insertCategory(category: NoteCategoryEntity): Long = noteCategoryDao.insertCategory(category)
    override suspend fun deleteCategory(category: NoteCategoryEntity) = noteCategoryDao.deleteCategory(category)
}
