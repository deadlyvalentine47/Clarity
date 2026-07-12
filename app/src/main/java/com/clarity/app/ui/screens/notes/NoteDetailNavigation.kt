package com.clarity.app.ui.screens.notes

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.ui.viewmodel.NoteViewModel

@Composable
fun NoteDetailNavigation(
    noteId: Long,
    onBack: () -> Unit,
    viewModel: NoteViewModel = hiltViewModel()
) {
    val notes by viewModel.notes.collectAsStateWithLifecycle()
    val categories by viewModel.categories.collectAsStateWithLifecycle()
    val note = notes.find { it.id == noteId }

    if (note != null) {
        NoteDetailScreen(
            note = note,
            availableCategories = categories.map { it.name },
            onBack = onBack,
            onEdit = { updatedNote ->
                viewModel.updateNote(updatedNote)
            },
            onPin = { viewModel.togglePin(note) },
            onDelete = {
                viewModel.deleteNote(note)
                onBack()
            }
        )
    }
}
