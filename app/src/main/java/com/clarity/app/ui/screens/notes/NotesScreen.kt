package com.clarity.app.ui.screens.notes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Label
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.data.local.database.NoteCategoryEntity
import com.clarity.app.data.local.database.NoteEntity
import com.clarity.app.ui.components.DeleteConfirmationDialog
import com.clarity.app.ui.viewmodel.NoteViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotesScreen(
    viewModel: NoteViewModel = hiltViewModel(),
    onNoteClick: (Long) -> Unit = {}
) {
    val notes by viewModel.notes.collectAsStateWithLifecycle()
    val categories by viewModel.categories.collectAsStateWithLifecycle()
    var showAddDialog by remember { mutableStateOf(false) }
    var editingNote by remember { mutableStateOf<NoteEntity?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var showManageCategories by remember { mutableStateOf(false) }
    var showFilterSheet by remember { mutableStateOf(false) }

    var selectedCategories by remember { mutableStateOf(setOf<String>()) }

    val hasActiveFilters = selectedCategories.isNotEmpty()
    val activeFilterCount = selectedCategories.size

    val filteredNotes = notes.filter { note ->
        val matchesSearch = searchQuery.isBlank() ||
                note.title.contains(searchQuery, ignoreCase = true) ||
                note.content.contains(searchQuery, ignoreCase = true)
        val matchesFilter = if (selectedCategories.isEmpty()) {
            true
        } else {
            val isPinnedSelected = "Pinned" in selectedCategories
            val isCategorySelected = selectedCategories.filter { it != "Pinned" }.any {
                note.category.equals(it, ignoreCase = true)
            }
            (isPinnedSelected && note.isPinned) || isCategorySelected
        }
        matchesSearch && matchesFilter
    }.sortedByDescending { it.isPinned }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add Note")
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search notes...") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) }
                )
                Box {
                    IconButton(onClick = { showFilterSheet = true }) {
                        BadgedBox(
                            badge = {
                                if (activeFilterCount > 0) {
                                    Badge { Text("$activeFilterCount") }
                                }
                            }
                        ) {
                            Icon(Icons.Default.FilterList, contentDescription = "Filter")
                        }
                    }
                }
                IconButton(onClick = { showManageCategories = true }) {
                    Icon(Icons.AutoMirrored.Outlined.Label, contentDescription = "Manage Categories")
                }
            }

            if (hasActiveFilters) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    selectedCategories.forEach { cat ->
                        FilterChip(
                            selected = true,
                            onClick = { selectedCategories = selectedCategories - cat },
                            label = { Text(cat) }
                        )
                    }
                }
            }

            if (filteredNotes.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No notes found", style = MaterialTheme.typography.headlineMedium)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            if (searchQuery.isBlank() && !hasActiveFilters) "Tap + to create your first note"
                            else "No notes match your filters",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(filteredNotes, key = { it.id }) { note ->
                        NoteItem(
                            note = note,
                            onPin = { viewModel.togglePin(note) },
                            onClick = { onNoteClick(note.id) },
                            onDelete = { viewModel.deleteNote(note) }
                        )
                    }
                }
            }
        }
    }

    if (showFilterSheet) {
        NoteFilterBottomSheet(
            categories = categories.map { it.name },
            selectedCategories = selectedCategories,
            onSelectionChanged = { selectedCategories = it },
            onDismiss = { showFilterSheet = false }
        )
    }

    if (showAddDialog) {
        AddNoteDialog(
            categories = categories.map { it.name },
            onDismiss = { showAddDialog = false },
            onConfirm = { note -> viewModel.addNote(note); showAddDialog = false }
        )
    }

    if (editingNote != null) {
        AddNoteDialog(
            note = editingNote,
            categories = categories.map { it.name },
            onDismiss = { editingNote = null },
            onConfirm = { note -> viewModel.updateNote(note); editingNote = null }
        )
    }

    if (showManageCategories) {
        ManageCategoriesDialog(
            categories = categories,
            onAdd = { viewModel.addCategory(it) },
            onDelete = { viewModel.deleteCategory(it) },
            onDismiss = { showManageCategories = false }
        )
    }
}

@Composable
fun NoteFilterBottomSheet(
    categories: List<String>,
    selectedCategories: Set<String>,
    onSelectionChanged: (Set<String>) -> Unit,
    onDismiss: () -> Unit
) {
    var localSelection by remember { mutableStateOf(selectedCategories) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Filter Notes")
                TextButton(onClick = { localSelection = emptySet() }) {
                    Text("Clear All")
                }
            }
        },
        text = {
            Column {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            localSelection = if ("Pinned" in localSelection) {
                                localSelection - "Pinned"
                            } else {
                                localSelection + "Pinned"
                            }
                        }
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Checkbox(
                        checked = "Pinned" in localSelection,
                        onCheckedChange = {
                            localSelection = if ("Pinned" in localSelection) {
                                localSelection - "Pinned"
                            } else {
                                localSelection + "Pinned"
                            }
                        }
                    )
                    Text("Pinned", style = MaterialTheme.typography.bodyMedium)
                }

                if (categories.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "CATEGORIES",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(4.dp))

                    LazyColumn(modifier = Modifier.heightIn(max = 300.dp)) {
                        items(categories) { category ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        localSelection = if (category in localSelection) {
                                            localSelection - category
                                        } else {
                                            localSelection + category
                                        }
                                    }
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Checkbox(
                                    checked = category in localSelection,
                                    onCheckedChange = {
                                        localSelection = if (category in localSelection) {
                                            localSelection - category
                                        } else {
                                            localSelection + category
                                        }
                                    }
                                )
                                Text(category, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onSelectionChanged(localSelection)
                onDismiss()
            }) {
                Text("Apply")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteDetailScreen(
    note: NoteEntity,
    availableCategories: List<String> = emptyList(),
    onBack: () -> Unit,
    onEdit: (NoteEntity) -> Unit,
    onPin: () -> Unit,
    onDelete: () -> Unit
) {
    var isEditing by remember { mutableStateOf(false) }
    var editTitle by remember { mutableStateOf(note.title) }
    var editContent by remember { mutableStateOf(note.content) }
    var currentTags by remember { mutableStateOf(
        note.category.split(",").map { it.trim() }.filter { it.isNotBlank() }.toMutableList()
    ) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showAddTagMenu by remember { mutableStateOf(false) }

    if (showDeleteDialog) {
        DeleteConfirmationDialog(
            title = "Delete Note",
            message = "Are you sure you want to delete \"${note.title}\"?",
            onConfirm = {
                onDelete()
                showDeleteDialog = false
            },
            onDismiss = { showDeleteDialog = false }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = note.title,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = onPin) {
                        Icon(
                            if (note.isPinned) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                            contentDescription = "Pin"
                        )
                    }
                    IconButton(onClick = {
                        if (isEditing) {
                            onEdit(note.copy(
                                title = editTitle.trim(),
                                content = editContent.trim(),
                                category = currentTags.joinToString(", "),
                                updatedAt = System.currentTimeMillis()
                            ))
                            isEditing = false
                        } else {
                            isEditing = true
                        }
                    }) {
                        Icon(
                            if (isEditing) Icons.Default.Check else Icons.Default.Edit,
                            contentDescription = if (isEditing) "Save" else "Edit"
                        )
                    }
                    IconButton(onClick = { showDeleteDialog = true }) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            if (isEditing) {
                OutlinedTextField(
                    value = editTitle,
                    onValueChange = { editTitle = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("Title") }
                )
                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Tags",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    currentTags.forEach { tag ->
                        FilterChip(
                            selected = true,
                            onClick = { currentTags = currentTags.toMutableList().apply { remove(tag) } },
                            label = { Text("$tag \u00D7") }
                        )
                    }
                    Box {
                        IconButton(onClick = { showAddTagMenu = true }) {
                            Icon(Icons.Default.Add, contentDescription = "Add Tag")
                        }
                        DropdownMenu(
                            expanded = showAddTagMenu,
                            onDismissRequest = { showAddTagMenu = false }
                        ) {
                            val existingTags = currentTags.toSet()
                            val available = availableCategories.filter { it !in existingTags }
                            if (available.isEmpty()) {
                                DropdownMenuItem(
                                    text = { Text("No more tags") },
                                    onClick = { showAddTagMenu = false }
                                )
                            } else {
                                available.forEach { tag ->
                                    DropdownMenuItem(
                                        text = { Text(tag) },
                                        onClick = {
                                            currentTags = currentTags.toMutableList().apply { add(tag) }
                                            showAddTagMenu = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = editContent,
                    onValueChange = { editContent = it },
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    label = { Text("Content (Markdown supported)") }
                )
            } else {
                Text(
                    text = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault()).format(Date(note.updatedAt)),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (currentTags.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        currentTags.forEach { tag ->
                            FilterChip(
                                selected = false,
                                onClick = {},
                                label = { Text(tag) }
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                MarkdownPreview(content = note.content)
            }
        }
    }
}

@Composable
fun ManageCategoriesDialog(
    categories: List<NoteCategoryEntity>,
    onAdd: (String) -> Unit,
    onDelete: (NoteCategoryEntity) -> Unit,
    onDismiss: () -> Unit
) {
    var newCategoryName by remember { mutableStateOf("") }
    var categoryToDelete by remember { mutableStateOf<NoteCategoryEntity?>(null) }

    if (categoryToDelete != null) {
        DeleteConfirmationDialog(
            title = "Delete Category",
            message = "Are you sure you want to delete \"${categoryToDelete!!.name}\"?",
            onConfirm = {
                onDelete(categoryToDelete!!)
                categoryToDelete = null
            },
            onDismiss = { categoryToDelete = null }
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Manage Categories") },
        text = {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = newCategoryName,
                        onValueChange = { newCategoryName = it },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        label = { Text("New category") }
                    )
                    TextButton(
                        onClick = {
                            if (newCategoryName.isNotBlank()) {
                                onAdd(newCategoryName.trim())
                                newCategoryName = ""
                            }
                        },
                        enabled = newCategoryName.isNotBlank()
                    ) {
                        Text("Add")
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                if (categories.isEmpty()) {
                    Text(
                        "No categories yet",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    LazyColumn(modifier = Modifier.heightIn(max = 300.dp)) {
                        items(categories) { category ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(category.name)
                                IconButton(onClick = { categoryToDelete = category }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Done")
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteItem(note: NoteEntity, onPin: () -> Unit, onClick: () -> Unit, onDelete: () -> Unit) {
    var showDeleteDialog by remember { mutableStateOf(false) }

    if (showDeleteDialog) {
        DeleteConfirmationDialog(
            title = "Delete Note",
            message = "Are you sure you want to delete \"${note.title}\"?",
            onConfirm = {
                onDelete()
                showDeleteDialog = false
            },
            onDismiss = { showDeleteDialog = false }
        )
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = note.title,
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.weight(1f)
                )
                Row {
                    IconButton(onClick = onPin, modifier = Modifier.height(32.dp)) {
                        Icon(
                            if (note.isPinned) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                            contentDescription = "Pin",
                            modifier = Modifier.height(16.dp)
                        )
                    }
                    IconButton(onClick = { showDeleteDialog = true }, modifier = Modifier.height(32.dp)) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", modifier = Modifier.height(16.dp))
                    }
                }
            }

            if (note.content.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = note.content,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(4.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    text = SimpleDateFormat("MMM dd", Locale.getDefault()).format(Date(note.createdAt)),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (note.category.isNotBlank()) {
                    Text(text = note.category, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
fun MarkdownPreview(content: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
    ) {
        val lines = content.split("\n")
        lines.forEach { line ->
            when {
                line.startsWith("# ") -> {
                    Text(
                        text = line.removePrefix("# "),
                        style = MaterialTheme.typography.headlineMedium,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                }
                line.startsWith("## ") -> {
                    Text(
                        text = line.removePrefix("## "),
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                }
                line.startsWith("### ") -> {
                    Text(
                        text = line.removePrefix("### "),
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                }
                line.startsWith("- ") || line.startsWith("* ") -> {
                    Text(
                        text = "• ${line.removePrefix("- ").removePrefix("* ")}",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }
                line.startsWith("1. ") || line.startsWith("2. ") || line.startsWith("3. ") -> {
                    Text(
                        text = line,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }
                line.startsWith("**") && line.endsWith("**") -> {
                    Text(
                        text = line.removeSurrounding("**"),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold
                        ),
                        modifier = Modifier.padding(vertical = 2.dp)
                    )
                }
                line.startsWith("*") && line.endsWith("*") && !line.startsWith("**") -> {
                    Text(
                        text = line.removeSurrounding("*"),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                        ),
                        modifier = Modifier.padding(vertical = 2.dp)
                    )
                }
                line.isBlank() -> {
                    Spacer(modifier = Modifier.height(8.dp))
                }
                else -> {
                    Text(
                        text = line,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(vertical = 2.dp)
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddNoteDialog(
    note: NoteEntity? = null,
    categories: List<String> = emptyList(),
    onDismiss: () -> Unit,
    onConfirm: (NoteEntity) -> Unit
) {
    var title by remember { mutableStateOf(note?.title ?: "") }
    var content by remember { mutableStateOf(note?.content ?: "") }
    var category by remember { mutableStateOf(note?.category ?: "") }
    var selectedTab by remember { mutableStateOf(0) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (note != null) "Edit Note" else "Add Note") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Title *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)

                TabRow(selectedTabIndex = selectedTab) {
                    Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("Edit") })
                    Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("Preview") })
                }

                if (selectedTab == 0) {
                    OutlinedTextField(value = content, onValueChange = { content = it }, label = { Text("Content (Markdown supported)") }, modifier = Modifier.fillMaxWidth(), minLines = 6)
                } else {
                    if (content.isNotBlank()) {
                        MarkdownPreview(content = content)
                    } else {
                        Text("Nothing to preview", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }

                Column {
                    Text("Category (optional)", style = MaterialTheme.typography.bodyMedium)
                    if (categories.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = category.isEmpty(),
                                onClick = { category = "" },
                                label = { Text("None") }
                            )
                            categories.forEach { cat ->
                                FilterChip(
                                    selected = category == cat,
                                    onClick = { category = if (category == cat) "" else cat },
                                    label = { Text(cat) }
                                )
                            }
                        }
                    } else {
                        Text(
                            text = "No categories yet. Add some in Manage Categories.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (title.isNotBlank()) {
                        if (note != null) {
                            onConfirm(note.copy(title = title.trim(), content = content.trim(), category = category.trim(), updatedAt = System.currentTimeMillis()))
                        } else {
                            onConfirm(NoteEntity(title = title.trim(), content = content.trim(), category = category.trim()))
                        }
                    }
                },
                enabled = title.isNotBlank()
            ) { Text(if (note != null) "Save" else "Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
