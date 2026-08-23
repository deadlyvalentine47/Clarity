package com.clarity.app.data.local.database

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface NoteDao {
    @Query("SELECT * FROM notes ORDER BY isPinned DESC, sortOrder ASC, updatedAt DESC")
    fun getAllNotes(): Flow<List<NoteEntity>>

    @Query("SELECT * FROM notes WHERE isPinned = 1 ORDER BY sortOrder ASC, updatedAt DESC")
    fun getPinnedNotes(): Flow<List<NoteEntity>>

    @Query("SELECT * FROM notes WHERE id = :noteId")
    fun getNoteById(noteId: Long): Flow<NoteEntity?>

    @Query("SELECT * FROM notes WHERE id = :noteId")
    suspend fun getNoteByIdOnce(noteId: Long): NoteEntity?

    @Query("SELECT * FROM notes WHERE parentNoteId = :parentId ORDER BY isPinned DESC, sortOrder ASC, updatedAt DESC")
    fun getNotesByParent(parentId: Long): Flow<List<NoteEntity>>

    @Query("UPDATE notes SET parentNoteId = :parentId WHERE id = :noteId")
    suspend fun setParentNote(noteId: Long, parentId: Long?)

    @Query("UPDATE notes SET sortOrder = :sortOrder WHERE id = :noteId")
    suspend fun setSortOrder(noteId: Long, sortOrder: Int)

    @Insert
    suspend fun insertNote(note: NoteEntity): Long

    @Update
    suspend fun updateNote(note: NoteEntity)

    @Delete
    suspend fun deleteNote(note: NoteEntity)

    @Query("DELETE FROM notes WHERE id = :noteId")
    suspend fun deleteNoteById(noteId: Long)

    @Query(
        "WITH RECURSIVE descendants(id) AS (" +
            "SELECT id FROM notes WHERE id = :noteId " +
            "UNION ALL " +
            "SELECT n.id FROM notes n INNER JOIN descendants d ON n.parentNoteId = d.id" +
        ") DELETE FROM notes WHERE id IN (SELECT id FROM descendants)"
    )
    suspend fun deleteNoteWithDescendants(noteId: Long)

    @Query("DELETE FROM notes")
    suspend fun deleteAllNotes()
}
