package com.clarity.app.ui.screens.habits

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.data.local.database.HabitEntity
import com.clarity.app.ui.components.DeleteConfirmationDialog
import com.clarity.app.ui.viewmodel.HabitViewModel
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HabitsScreen(
    onHabitClick: (Long) -> Unit = {},
    viewModel: HabitViewModel = hiltViewModel()
) {
    val activeHabits by viewModel.activeHabits.collectAsStateWithLifecycle()
    var showAddDialog by remember { mutableStateOf(false) }
    var editingHabit by remember { mutableStateOf<HabitEntity?>(null) }
    var deletingHabit by remember { mutableStateOf<HabitEntity?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var frequencyFilter by remember { mutableStateOf("All") }
    val frequencyOptions = listOf("All", "Daily", "Weekly", "Monthly", "Alternate")

    val filteredHabits = activeHabits.filter { habit ->
        val matchesSearch = searchQuery.isEmpty() ||
                habit.name.contains(searchQuery, ignoreCase = true) ||
                habit.description.contains(searchQuery, ignoreCase = true)
        val matchesFrequency = frequencyFilter == "All" || habit.frequency == frequencyFilter
        matchesSearch && matchesFrequency
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add Habit")
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Text(
                    text = "TODAY - ${LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE, MMM d"))}",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    label = { Text("Search habits") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }

            item {
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    frequencyOptions.forEach { option ->
                        FilterChip(
                            selected = frequencyFilter == option,
                            onClick = { frequencyFilter = option },
                            label = { Text(option) }
                        )
                    }
                }
            }

            if (filteredHabits.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(top = 32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (activeHabits.isEmpty()) "No habits yet\nTap + to start building habits"
                            else "No habits match your filters",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            items(filteredHabits, key = { it.id }) { habit ->
                HabitItem(
                    habit = habit,
                    onClick = { onHabitClick(habit.id) },
                    onToggle = { viewModel.toggleHabitForToday(habit.id) },
                    onEdit = { editingHabit = habit },
                    onArchive = { viewModel.archiveHabit(habit.id) },
                    onDelete = { deletingHabit = habit }
                )
            }
        }
    }

    if (showAddDialog) {
        AddEditHabitDialog(
            onDismiss = { showAddDialog = false },
            onConfirm = { habit ->
                viewModel.addHabit(habit)
                showAddDialog = false
            }
        )
    }

    if (editingHabit != null) {
        AddEditHabitDialog(
            habit = editingHabit!!,
            onDismiss = { editingHabit = null },
            onConfirm = { habit ->
                viewModel.updateHabit(habit)
                editingHabit = null
            }
        )
    }

    deletingHabit?.let { habit ->
        DeleteConfirmationDialog(
            title = "Delete Habit",
            message = "Are you sure you want to delete \"${habit.name}\"?",
            onConfirm = {
                viewModel.deleteHabit(habit)
                deletingHabit = null
            },
            onDismiss = { deletingHabit = null }
        )
    }
}

@Composable
fun HabitItem(
    habit: HabitEntity,
    onClick: () -> Unit,
    onToggle: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onArchive: () -> Unit = {}
) {
    val today = LocalDate.now().toString()
    val isCompletedToday = habit.completionHistory[today] ?: false

    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = habit.name,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium
                    )
                    if (habit.description.isNotBlank()) {
                        Text(
                            text = habit.description,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Text(
                        text = if (habit.frequency == "Alternate" && habit.alternateDays != null)
                            "Alternate · Every ${habit.alternateDays + 1} days"
                        else habit.frequency,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                IconButton(onClick = onEdit) {
                    Icon(Icons.Default.Edit, contentDescription = "Edit", modifier = Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                IconButton(onClick = onArchive) {
                    Icon(Icons.Default.Archive, contentDescription = "Archive", modifier = Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete", modifier = Modifier.size(20.dp), tint = MaterialTheme.colorScheme.error)
                }
                IconButton(
                    onClick = onToggle,
                    modifier = Modifier.size(40.dp).clip(CircleShape).background(
                        if (isCompletedToday) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Icon(
                        Icons.Default.Check,
                        contentDescription = if (isCompletedToday) "Completed" else "Mark complete",
                        tint = if (isCompletedToday) MaterialTheme.colorScheme.onPrimary
                        else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
fun AddEditHabitDialog(
    habit: HabitEntity? = null,
    onDismiss: () -> Unit,
    onConfirm: (HabitEntity) -> Unit
) {
    var name by remember { mutableStateOf(habit?.name ?: "") }
    var description by remember { mutableStateOf(habit?.description ?: "") }
    var frequency by remember { mutableStateOf(habit?.frequency ?: "Daily") }
    var frequencyExpanded by remember { mutableStateOf(false) }
    var alternateDaysText by remember { mutableStateOf(habit?.alternateDays?.toString() ?: "") }
    val isEditing = habit != null
    val frequencyOptions = listOf("Daily", "Weekly", "Monthly", "Alternate")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (isEditing) "Edit Habit" else "Add Habit") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Habit Name *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )
                Box {
                    OutlinedTextField(
                        value = frequency,
                        onValueChange = {},
                        label = { Text("Frequency") },
                        modifier = Modifier.fillMaxWidth(),
                        readOnly = true,
                        singleLine = true
                    )
                    DropdownMenu(
                        expanded = frequencyExpanded,
                        onDismissRequest = { frequencyExpanded = false }
                    ) {
                        frequencyOptions.forEach { option ->
                            DropdownMenuItem(
                                text = { Text(option) },
                                onClick = { frequency = option; frequencyExpanded = false }
                            )
                        }
                    }
                }
                if (frequency == "Alternate") {
                    OutlinedTextField(
                        value = alternateDaysText,
                        onValueChange = { alternateDaysText = it.filter { c -> c.isDigit() } },
                        label = { Text("Skip days between (1 = every other day)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (name.isNotBlank()) {
                        val alternateDays = if (frequency == "Alternate") alternateDaysText.toIntOrNull() else null
                        if (frequency == "Alternate" && (alternateDays == null || alternateDays < 1)) return@TextButton
                        if (isEditing) {
                            onConfirm(habit!!.copy(
                                name = name.trim(),
                                description = description.trim(),
                                frequency = frequency,
                                alternateDays = alternateDays
                            ))
                        } else {
                            onConfirm(
                                HabitEntity(
                                    name = name.trim(),
                                    description = description.trim(),
                                    frequency = frequency,
                                    alternateDays = alternateDays
                                )
                            )
                        }
                    }
                },
                enabled = name.isNotBlank()
            ) {
                Text(if (isEditing) "Save" else "Add")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
