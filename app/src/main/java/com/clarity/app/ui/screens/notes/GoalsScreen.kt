package com.clarity.app.ui.screens.notes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.data.local.database.GoalEntity
import com.clarity.app.ui.components.DeleteConfirmationDialog
import com.clarity.app.ui.viewmodel.GoalViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GoalsScreen(
    viewModel: GoalViewModel = hiltViewModel()
) {
    val activeGoals by viewModel.activeGoals.collectAsStateWithLifecycle()
    val completedGoals by viewModel.completedGoals.collectAsStateWithLifecycle()
    var showAddDialog by remember { mutableStateOf(false) }
    var editingGoal by remember { mutableStateOf<GoalEntity?>(null) }
    var selectedTab by remember { mutableStateOf("Active") }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add Goal")
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier.fillMaxSize().padding(paddingValues)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf("Active", "Completed").forEach { tab ->
                    FilterChip(selected = selectedTab == tab, onClick = { selectedTab = tab }, label = { Text(tab) })
                }
            }

            val goals = if (selectedTab == "Active") activeGoals else completedGoals

            if (goals.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No goals yet", style = MaterialTheme.typography.headlineMedium)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Tap + to set your first goal", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(bottom = 80.dp)
                ) {
                    items(goals, key = { it.id }) { goal ->
                        GoalItem(
                            goal = goal,
                            onEdit = { editingGoal = goal },
                            onDelete = { viewModel.deleteGoal(goal) },
                            onUpdateProgress = {},
                            onToggleMilestone = { milestone, isCompleted ->
                                viewModel.toggleMilestone(goal, milestone, isCompleted)
                            }
                        )
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        AddGoalDialog(
            onDismiss = { showAddDialog = false },
            onConfirm = { goal -> viewModel.addGoal(goal); showAddDialog = false }
        )
    }

    if (editingGoal != null) {
        AddGoalDialog(
            goal = editingGoal,
            onDismiss = { editingGoal = null },
            onConfirm = { goal -> viewModel.updateGoal(goal); editingGoal = null }
        )
    }
}

@Composable
fun GoalItem(
    goal: GoalEntity,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onUpdateProgress: (Float) -> Unit,
    onToggleMilestone: (String, Boolean) -> Unit
) {
    var showMilestones by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }

    if (showDeleteDialog) {
        DeleteConfirmationDialog(
            title = "Delete Goal",
            message = "Are you sure you want to delete \"${goal.title}\"?",
            onConfirm = {
                onDelete()
                showDeleteDialog = false
            },
            onDismiss = { showDeleteDialog = false }
        )
    }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = goal.title, style = MaterialTheme.typography.bodyLarge)
                    Text(text = goal.type, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Row {
                    IconButton(onClick = onEdit) { Icon(Icons.Default.Add, contentDescription = "Edit") }
                    IconButton(onClick = { showDeleteDialog = true }) { Icon(Icons.Default.Delete, contentDescription = "Delete") }
                }
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            LinearProgressIndicator(progress = { goal.progress }, modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = "${(goal.progress * 100).toInt()}%", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            
            if (goal.description.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = goal.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            if (goal.milestones.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                TextButton(onClick = { showMilestones = !showMilestones }) {
                    Text(if (showMilestones) "Hide Milestones" else "Show Milestones (${goal.completedMilestones.size}/${goal.milestones.size})")
                }
            }

            if (showMilestones) {
                goal.milestones.forEach { milestone ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(start = 16.dp, top = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = goal.completedMilestones.contains(milestone),
                            onCheckedChange = { onToggleMilestone(milestone, it) }
                        )
                        Text(
                            text = milestone,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun AddGoalDialog(
    goal: GoalEntity? = null,
    onDismiss: () -> Unit,
    onConfirm: (GoalEntity) -> Unit
) {
    var title by remember { mutableStateOf(goal?.title ?: "") }
    var description by remember { mutableStateOf(goal?.description ?: "") }
    var type by remember { mutableStateOf(goal?.type ?: "Short-term") }
    var milestones by remember { mutableStateOf(goal?.milestones ?: emptyList()) }
    var completedMilestones by remember { mutableStateOf(goal?.completedMilestones ?: emptyList()) }
    var showAddMilestone by remember { mutableStateOf(false) }
    var newMilestone by remember { mutableStateOf("") }

    if (showAddMilestone) {
        AlertDialog(
            onDismissRequest = { showAddMilestone = false; newMilestone = "" },
            title = { Text("Add Milestone") },
            text = {
                OutlinedTextField(
                    value = newMilestone,
                    onValueChange = { newMilestone = it },
                    label = { Text("Milestone") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (newMilestone.isNotBlank()) {
                            milestones = milestones + newMilestone.trim()
                            newMilestone = ""
                            showAddMilestone = false
                        }
                    },
                    enabled = newMilestone.isNotBlank()
                ) { Text("Add") }
            },
            dismissButton = { TextButton(onClick = { showAddMilestone = false; newMilestone = "" }) { Text("Cancel") } }
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (goal != null) "Edit Goal" else "Add Goal") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Goal *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("Short-term", "Long-term").forEach { option ->
                        FilterChip(selected = type == option, onClick = { type = option }, label = { Text(option) })
                    }
                }

                Text("Milestones", style = MaterialTheme.typography.bodyMedium)
                milestones.forEach { milestone ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(milestone, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
                        if (goal == null) {
                            IconButton(onClick = { milestones = milestones - milestone }) {
                                Icon(Icons.Default.Close, contentDescription = "Remove", modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
                IconButton(onClick = { showAddMilestone = true }) {
                    Icon(Icons.Default.Add, contentDescription = "Add Milestone")
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (title.isNotBlank() && milestones.isNotEmpty()) {
                        val computedProgress = if (milestones.isEmpty()) 0f
                            else completedMilestones.size.toFloat() / milestones.size.toFloat()
                        onConfirm(
                            GoalEntity(
                                id = goal?.id ?: 0,
                                title = title.trim(),
                                description = description.trim(),
                                type = type,
                                progress = computedProgress,
                                milestones = milestones,
                                completedMilestones = if (goal != null) completedMilestones else emptyList(),
                                createdAt = goal?.createdAt ?: System.currentTimeMillis()
                            )
                        )
                    }
                },
                enabled = title.isNotBlank() && milestones.isNotEmpty()
            ) { Text(if (goal != null) "Save" else "Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
