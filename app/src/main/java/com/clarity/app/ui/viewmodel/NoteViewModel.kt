package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.NoteCategoryEntity
import com.clarity.app.data.local.database.NoteEntity
import com.clarity.app.domain.repository.NoteRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class NoteViewModel @Inject constructor(
    private val noteRepository: NoteRepository
) : ViewModel() {

    val notes: StateFlow<List<NoteEntity>> = noteRepository.getAllNotes()
        .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = emptyList())

    val categories: StateFlow<List<NoteCategoryEntity>> = noteRepository.getAllCategories()
        .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = emptyList())

    fun addNote(note: NoteEntity) {
        viewModelScope.launch { noteRepository.insertNote(note) }
    }

    fun updateNote(note: NoteEntity) {
        viewModelScope.launch { noteRepository.updateNote(note) }
    }

    fun deleteNote(note: NoteEntity) {
        viewModelScope.launch { noteRepository.deleteNote(note) }
    }

    fun deleteNoteWithDescendants(noteId: Long) {
        viewModelScope.launch { noteRepository.deleteNoteWithDescendants(noteId) }
    }

    fun addChildNote(parentId: Long, title: String, content: String = "", onCreated: (Long) -> Unit = {}) {
        viewModelScope.launch {
            val newId = noteRepository.insertNote(
                NoteEntity(
                    title = title.ifBlank { "Untitled" },
                    content = content,
                    parentNoteId = parentId,
                    createdAt = System.currentTimeMillis(),
                    updatedAt = System.currentTimeMillis()
                )
            )
            onCreated(newId)
        }
    }

    fun togglePin(note: NoteEntity) {
        viewModelScope.launch { noteRepository.updateNote(note.copy(isPinned = !note.isPinned)) }
    }

    fun addCategory(name: String) {
        viewModelScope.launch { noteRepository.insertCategory(NoteCategoryEntity(name = name)) }
    }

    fun deleteCategory(category: NoteCategoryEntity) {
        viewModelScope.launch { noteRepository.deleteCategory(category) }
    }
}
