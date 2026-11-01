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
    onGoToNotes: () -> Unit = {},
    onOpenChild: (Long) -> Unit = {},
    viewModel: NoteViewModel = hiltViewModel()
) {
    val notes by viewModel.notes.collectAsStateWithLifecycle()
    val categories by viewModel.categories.collectAsStateWithLifecycle()
    val note = notes.find { it.id == noteId }

    if (note != null) {
        val children = notes.filter { it.parentNoteId == noteId }
        NoteDetailScreen(
            note = note,
            children = children,
            availableCategories = categories.map { it.name },
            onBack = onBack,
            onEdit = { updatedNote ->
                viewModel.updateNote(updatedNote)
            },
            onPin = { viewModel.togglePin(note) },
            onDelete = {
                viewModel.deleteNoteWithDescendants(note.id)
                onBack()
            },
            onGoToNotes = onGoToNotes,
            onOpenChild = onOpenChild,
            onAddChild = { title ->
                viewModel.addChildNote(note.id, title)
            },
            onDeleteChild = { childId ->
                viewModel.deleteNoteWithDescendants(childId)
            }
        )
    }
}
