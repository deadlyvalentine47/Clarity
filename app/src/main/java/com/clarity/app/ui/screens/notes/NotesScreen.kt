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
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Label
import androidx.compose.material.icons.automirrored.outlined.Note
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowRight
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
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.TextFieldValue
import coil.compose.AsyncImage
import androidx.compose.ui.unit.dp
import android.widget.Toast
import android.util.Log
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.data.local.database.NoteCategoryEntity
import com.clarity.app.data.local.database.NoteEntity
import com.clarity.app.ui.components.DeleteConfirmationDialog
import com.clarity.app.ui.viewmodel.NoteViewModel
import com.clarity.app.util.ImageStorage
import com.clarity.app.util.StoragePermission
import androidx.compose.runtime.LaunchedEffect
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class DropZone { ABOVE, BELOW, INSIDE }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotesScreen(
    viewModel: NoteViewModel = hiltViewModel(),
    onNoteClick: (Long) -> Unit = {}
) {
    val context = LocalContext.current
    LaunchedEffect(Unit) {
        if (!StoragePermission.hasAllFilesAccess(context)) {
            StoragePermission.requestAllFilesAccess(context)
        }
    }

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

    val isTreeMode = searchQuery.isBlank() && !hasActiveFilters
    var expandedIds by remember { mutableStateOf(setOf<Long>()) }

    var draggedNoteId by remember { mutableStateOf<Long?>(null) }
    var dragOffset by remember { mutableStateOf(Offset.Zero) }
    var hoveredNoteId by remember { mutableStateOf<Long?>(null) }
    var hoveredZone by remember { mutableStateOf<DropZone?>(null) }
    val itemBounds = remember { mutableStateMapOf<Long, Pair<Offset, IntSize>>() }
    val listBounds = remember { mutableStateOf(Pair(Offset.Zero, IntSize(0, 0))) }
    val density = LocalDensity.current
    val dragAlpha = 0.85f

    val childCountById: Map<Long, Int> = remember(notes) {
        notes.filter { it.parentNoteId != null }.groupingBy { it.parentNoteId!! }.eachCount()
    }

    val treeNodes: List<Pair<NoteEntity, Int>> = if (isTreeMode) {
        val childrenByParent = notes.filter { it.parentNoteId != null }.groupBy { it.parentNoteId!! }
        val sorted: (List<NoteEntity>) -> List<NoteEntity> = { list ->
            list.sortedWith(compareByDescending<NoteEntity> { it.isPinned }.thenByDescending { it.updatedAt })
        }
        val result = mutableListOf<Pair<NoteEntity, Int>>()
        fun visit(note: NoteEntity, depth: Int) {
            result.add(note to depth)
            if (note.id in expandedIds) {
                sorted(childrenByParent[note.id].orEmpty()).forEach { visit(it, depth + 1) }
            }
        }
        sorted(notes.filter { it.parentNoteId == null }).forEach { visit(it, 0) }
        result
    } else {
        emptyList()
    }

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
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .onGloballyPositioned { coords ->
                            listBounds.value = coords.positionInRoot() to coords.size
                        }
                ) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(bottom = 80.dp)
                    ) {
                        if (isTreeMode) {
                            items(treeNodes, key = { it.first.id }) { (note, depth) ->
                                val isDragged = draggedNoteId == note.id
                                val isHovered = hoveredNoteId == note.id
                                val zone = if (isHovered) hoveredZone else null

                                NoteItem(
                                    note = note,
                                    depth = depth,
                                    childCount = childCountById[note.id] ?: 0,
                                    isExpanded = note.id in expandedIds,
                                    onToggleExpand = {
                                        expandedIds = if (note.id in expandedIds) {
                                            expandedIds - note.id
                                        } else {
                                            expandedIds + note.id
                                        }
                                    },
                                    onPin = { viewModel.togglePin(note) },
                                    onClick = {
                                        if (draggedNoteId == null) onNoteClick(note.id)
                                    },
                                    onDelete = { viewModel.deleteNoteWithDescendants(note.id) },
                                    isDragged = isDragged,
                                    dropZone = zone,
                                    modifier = Modifier
                                        .onGloballyPositioned { coords ->
                                            itemBounds[note.id] = coords.positionInRoot() to coords.size
                                        }
                                        .pointerInput(note.id) {
                                            detectDragGesturesAfterLongPress(
                                                onDragStart = {
                                                    draggedNoteId = note.id
                                                    dragOffset = Offset.Zero
                                                },
                                                onDrag = { change, amount ->
                                                    change.consume()
                                                    dragOffset += amount
                                                    val pointerAbs = itemBounds[note.id]?.let {
                                                        it.first + Offset(it.second.width / 2f, it.second.height / 2f) + dragOffset
                                                    } ?: return@detectDragGesturesAfterLongPress
                                                    var bestId: Long? = null
                                                    var bestZone: DropZone? = null
                                                    for ((id, pair) in itemBounds) {
                                                        if (id == note.id) continue
                                                        val (pos, size) = pair
                                                        val cx = pos.x + size.width / 2f
                                                        val cy = pos.y + size.height / 2f
                                                        val dx = kotlin.math.abs(pointerAbs.x - cx)
                                                        val dy = kotlin.math.abs(pointerAbs.y - cy)
                                                        if (dx < size.width / 2f + 40 && dy < size.height / 2f + 20) {
                                                            bestId = id
                                                            bestZone = when {
                                                                pointerAbs.y < pos.y + size.height * 0.25f -> DropZone.ABOVE
                                                                pointerAbs.y > pos.y + size.height * 0.75f -> DropZone.BELOW
                                                                else -> DropZone.INSIDE
                                                            }
                                                            break
                                                        }
                                                    }
                                                    hoveredNoteId = bestId
                                                    hoveredZone = bestZone
                                                },
                                                onDragEnd = {
                                                    val hId = hoveredNoteId
                                                    val hZone = hoveredZone
                                                    if (hId != null && hZone != null && hId != draggedNoteId) {
                                                        val targetNote = notes.find { it.id == hId }
                                                        when (hZone) {
                                                            DropZone.INSIDE -> {
                                                                viewModel.reorderNote(
                                                                    noteId = draggedNoteId!!,
                                                                    newParentId = hId,
                                                                    newSortOrder = 0
                                                                )
                                                            }
                                                            DropZone.ABOVE -> {
                                                                viewModel.reorderNote(
                                                                    noteId = draggedNoteId!!,
                                                                    newParentId = targetNote?.parentNoteId,
                                                                    newSortOrder = (targetNote?.sortOrder ?: 0) - 1
                                                                )
                                                            }
                                                            DropZone.BELOW -> {
                                                                viewModel.reorderNote(
                                                                    noteId = draggedNoteId!!,
                                                                    newParentId = targetNote?.parentNoteId,
                                                                    newSortOrder = (targetNote?.sortOrder ?: 0) + 1
                                                                )
                                                            }
                                                        }
                                                    }
                                                    draggedNoteId = null
                                                    dragOffset = Offset.Zero
                                                    hoveredNoteId = null
                                                    hoveredZone = null
                                                },
                                                onDragCancel = {
                                                    draggedNoteId = null
                                                    dragOffset = Offset.Zero
                                                    hoveredNoteId = null
                                                    hoveredZone = null
                                                }
                                            )
                                        }
                                )
                            }
                        } else {
                            items(filteredNotes, key = { it.id }) { note ->
                                NoteItem(
                                    note = note,
                                    childCount = childCountById[note.id] ?: 0,
                                    onPin = { viewModel.togglePin(note) },
                                    onClick = { onNoteClick(note.id) },
                                    onDelete = { viewModel.deleteNoteWithDescendants(note.id) }
                                )
                            }
                        }
                    }

                    if (draggedNoteId != null) {
                        val dragged = notes.find { it.id == draggedNoteId }
                        if (dragged != null) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp)
                                    .graphicsLayer {
                                        translationX = dragOffset.x
                                        translationY = dragOffset.y
                                        alpha = dragAlpha
                                        shadowElevation = 12f
                                        shape = RoundedCornerShape(12.dp)
                                        clip = true
                                    }
                            ) {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(
                                        containerColor = MaterialTheme.colorScheme.primaryContainer
                                    ),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
                                ) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Text(
                                            text = dragged.title,
                                            style = MaterialTheme.typography.bodyLarge,
                                            fontWeight = androidx.compose.ui.text.font.FontWeight.Medium
                                        )
                                        if (childCountById[dragged.id] ?: 0 > 0) {
                                            Text(
                                                text = "+${childCountById[dragged.id]} pages",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    }
                                }
                            }
                        }
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
    children: List<NoteEntity> = emptyList(),
    availableCategories: List<String> = emptyList(),
    onBack: () -> Unit,
    onEdit: (NoteEntity) -> Unit,
    onPin: () -> Unit,
    onDelete: () -> Unit,
    onGoToNotes: () -> Unit = {},
    onOpenChild: (Long) -> Unit = {},
    onAddChild: (String) -> Unit = {},
    onDeleteChild: (Long) -> Unit = {}
) {
    var isEditing by remember { mutableStateOf(false) }
    var editTitle by remember { mutableStateOf(note.title) }
    var editContentState by remember { mutableStateOf(TextFieldValue(note.content)) }
    var currentTags by remember { mutableStateOf(
        note.category.split(",").map { it.trim() }.filter { it.isNotBlank() }.toMutableList()
    ) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showAddTagMenu by remember { mutableStateOf(false) }
    var showAddPageDialog by remember { mutableStateOf(false) }
    var deleteChild by remember { mutableStateOf<NoteEntity?>(null) }
    val pickImage = rememberImagePicker { uuid ->
        editContentState = insertImageMarker(editContentState, uuid)
    }

    deleteChild?.let { childToDelete ->
        DeleteConfirmationDialog(
            title = "Delete page",
            message = "Are you sure you want to delete \"${childToDelete.title}\" and all its nested pages?",
            onConfirm = {
                onDeleteChild(childToDelete.id)
                deleteChild = null
            },
            onDismiss = { deleteChild = null }
        )
    }

    if (showDeleteDialog) {
        DeleteConfirmationDialog(
            title = "Delete Note",
            message = if (children.isNotEmpty())
                "Are you sure you want to delete \"${note.title}\" and its ${children.size} nested page(s)?"
            else
                "Are you sure you want to delete \"${note.title}\"?",
            onConfirm = {
                onDelete()
                showDeleteDialog = false
            },
            onDismiss = { showDeleteDialog = false }
        )
    }

    if (showAddPageDialog) {
        AddChildPageDialog(
            onDismiss = { showAddPageDialog = false },
            onConfirm = { title ->
                onAddChild(title)
                showAddPageDialog = false
            }
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
                    IconButton(onClick = onGoToNotes) {
                        Icon(
                            Icons.AutoMirrored.Outlined.Note,
                            contentDescription = "All notes"
                        )
                    }
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
                                content = editContentState.text.trim(),
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
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                ) {
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
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = pickImage) { Text("+ Add image") }
                }
                OutlinedTextField(
                    value = editContentState,
                    onValueChange = { editContentState = it },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 6,
                    label = { Text("Content (Markdown supported)") }
                )
                InlineImagePreview(content = editContentState.text)
                }
            } else {
                Column(modifier = Modifier.fillMaxSize()) {
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

                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Pages inside (${children.size})",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold
                        )
                        TextButton(onClick = { showAddPageDialog = true }) {
                            Text("+ Add page")
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    if (children.isEmpty()) {
                        Text(
                            text = "No pages yet. Add a page to organise nested content.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        children.sortedWith(
                            compareByDescending<NoteEntity> { it.isPinned }
                                .thenByDescending { it.updatedAt }
                        ).forEach { child ->
                            Card(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                onClick = { onOpenChild(child.id) }
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(child.title, style = MaterialTheme.typography.bodyLarge, fontWeight = androidx.compose.ui.text.font.FontWeight.Medium)
                                        if (child.content.isNotBlank()) {
                                            Text(
                                                text = child.content,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                    }
                                    Text(
                                        text = SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(child.updatedAt)),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    IconButton(onClick = { deleteChild = child }) {
                                        Icon(
                                            Icons.Default.Delete,
                                            contentDescription = "Delete page",
                                            tint = MaterialTheme.colorScheme.error
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    HorizontalDivider()
                    Spacer(modifier = Modifier.height(8.dp))
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                    ) {
                        MarkdownPreview(content = note.content)
                    }
                }
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
fun NoteItem(
    note: NoteEntity,
    onPin: () -> Unit,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    depth: Int = 0,
    childCount: Int = 0,
    isExpanded: Boolean = true,
    onToggleExpand: () -> Unit = {},
    isDragged: Boolean = false,
    dropZone: DropZone? = null,
    modifier: Modifier = Modifier
) {
    var showDeleteDialog by remember { mutableStateOf(false) }

    if (showDeleteDialog) {
        DeleteConfirmationDialog(
            title = "Delete Note",
            message = if (childCount > 0)
                "Are you sure you want to delete \"${note.title}\" and its $childCount nested page(s)?"
            else
                "Are you sure you want to delete \"${note.title}\"?",
            onConfirm = {
                onDelete()
                showDeleteDialog = false
            },
            onDismiss = { showDeleteDialog = false }
        )
    }

    val borderColor = when (dropZone) {
        DropZone.INSIDE -> MaterialTheme.colorScheme.primary
        DropZone.ABOVE -> MaterialTheme.colorScheme.tertiary
        DropZone.BELOW -> MaterialTheme.colorScheme.tertiary
        null -> Color.Transparent
    }
    val borderWidth = if (dropZone != null) 2.dp else 0.dp

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(start = (depth * 20).dp)
            .then(
                if (isDragged) Modifier.graphicsLayer { alpha = 0.4f }
                else Modifier
            ),
        onClick = onClick,
        colors = if (dropZone == DropZone.INSIDE)
            CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f))
        else CardDefaults.cardColors(),
        border = if (dropZone != null) androidx.compose.foundation.BorderStroke(borderWidth, borderColor) else null
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                if (childCount > 0) {
                    IconButton(onClick = onToggleExpand, modifier = Modifier.height(32.dp)) {
                        Icon(
                            if (isExpanded) Icons.Default.KeyboardArrowDown else Icons.Default.KeyboardArrowRight,
                            contentDescription = if (isExpanded) "Collapse" else "Expand",
                            modifier = Modifier.height(16.dp)
                        )
                    }
                }
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
    val context = LocalContext.current
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
    ) {
        val lines = content.split("\n")
        lines.forEach { line ->
            val imageUuid = ImageStorage.extractUuid(line)
            if (imageUuid != null) {
                AsyncImage(
                    model = ImageStorage.imageModel(context, imageUuid),
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .padding(vertical = 4.dp)
                )
                return@forEach
            }
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
    var contentState by remember { mutableStateOf(TextFieldValue(note?.content ?: "")) }
    var category by remember { mutableStateOf(note?.category ?: "") }
    var selectedTab by remember { mutableStateOf(0) }
    val pickImage = rememberImagePicker { uuid ->
        contentState = insertImageMarker(contentState, uuid)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (note != null) "Edit Note" else "Add Note") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Title *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)

                TabRow(selectedTabIndex = selectedTab) {
                    Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("Edit") })
                    Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("Preview") })
                }

                if (selectedTab == 0) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End
                    ) {
                        TextButton(onClick = pickImage) { Text("+ Add image") }
                    }
                    OutlinedTextField(
                        value = contentState,
                        onValueChange = { contentState = it },
                        label = { Text("Content (Markdown supported)") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 6
                    )
                    InlineImagePreview(content = contentState.text)
                } else {
                    if (contentState.text.isNotBlank()) {
                        MarkdownPreview(content = contentState.text)
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
                            onConfirm(note.copy(title = title.trim(), content = contentState.text.trim(), category = category.trim(), updatedAt = System.currentTimeMillis()))
                        } else {
                            onConfirm(NoteEntity(title = title.trim(), content = contentState.text.trim(), category = category.trim()))
                        }
                    }
                },
                enabled = title.isNotBlank()
            ) { Text(if (note != null) "Save" else "Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
fun AddChildPageDialog(
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var title by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New page") },
        text = {
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Page title") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(title.trim()) }) { Text("Create") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun InlineImagePreview(content: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val uuids = content.split("\n").mapNotNull { ImageStorage.extractUuid(it) }
    if (uuids.isEmpty()) return
    Column(modifier = modifier.fillMaxWidth()) {
        uuids.forEach { uuid ->
            AsyncImage(
                model = ImageStorage.imageModel(context, uuid),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .padding(vertical = 4.dp)
            )
        }
    }
}

@Composable
private fun rememberImagePicker(onImagePicked: (String) -> Unit): () -> Unit {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            val stream = try {
                context.contentResolver.openInputStream(uri)
            } catch (e: Exception) {
                Log.e("ImageStorage", "openInputStream failed: ${e.message}", e)
                null
            }
            if (stream == null) {
                Toast.makeText(context, "Failed to open picked image", Toast.LENGTH_LONG).show()
                return@rememberLauncherForActivityResult
            }
            scope.launch {
                val result = withContext(Dispatchers.IO) {
                    runCatching {
                        if (!StoragePermission.hasAllFilesAccess(context)) {
                            error("Storage permission required")
                        }
                        stream.use { ImageStorage.saveImage(context, it.readBytes()) }
                    }
                }
                result.fold(
                    onSuccess = { uuid -> onImagePicked(uuid) },
                    onFailure = { e ->
                        Log.e("ImageStorage", "saveImage failed: ${e.message}", e)
                        if (e.message == "Storage permission required") {
                            StoragePermission.requestAllFilesAccess(context)
                            Toast.makeText(
                                context,
                                "Please allow 'All files access' to save images to the clarity folder",
                                Toast.LENGTH_LONG
                            ).show()
                        } else {
                            Toast.makeText(
                                context,
                                "Failed to save image: ${e.message}",
                                Toast.LENGTH_LONG
                            ).show()
                        }
                    }
                )
            }
        }
    }
    return { launcher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
}

private fun insertImageMarker(value: TextFieldValue, uuid: String): TextFieldValue {
    val text = value.text
    val start = value.selection.start.coerceIn(0, text.length)
    val marker = ImageStorage.marker(uuid)
    val before = text.take(start)
    val after = text.drop(start)
    val needsLeading = before.isNotEmpty() && !before.endsWith("\n")
    val needsTrailing = after.isNotEmpty() && !after.startsWith("\n")
    val insertion = (if (needsLeading) "\n" else "") + marker + (if (needsTrailing) "\n" else "")
    val newText = before + insertion + after
    val newCursor = (start + insertion.length).coerceIn(0, newText.length)
    return TextFieldValue(newText, TextRange(newCursor))
}
