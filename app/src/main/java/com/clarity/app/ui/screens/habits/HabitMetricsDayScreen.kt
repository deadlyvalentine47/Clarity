package com.clarity.app.ui.screens.habits

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.data.local.database.HabitEntity
import com.clarity.app.ui.viewmodel.HabitViewModel
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HabitMetricsDayScreen(
    date: String,
    onBack: () -> Unit = {},
    viewModel: HabitViewModel = hiltViewModel()
) {
    val habits by viewModel.metricsHabits.collectAsStateWithLifecycle()
    val day = runCatching { LocalDate.parse(date) }.getOrNull() ?: LocalDate.now()
    val dayStr = day.toString()

    val journal by viewModel.getJournalForDate(dayStr).collectAsStateWithLifecycle(initialValue = null)
    var journalText by remember { mutableStateOf("") }
    var journalExpanded by remember { mutableStateOf(false) }
    var expandedHabitId by remember { mutableStateOf<Long?>(null) }
    val habitNotes = remember { mutableStateMapOf<Long, String>() }

    LaunchedEffect(journal) {
        if (journal != null && journalText.isEmpty()) {
            journalText = journal!!.content
        }
    }

    LaunchedEffect(habits, dayStr) {
        habits.forEach { habit ->
            if (habit.id !in habitNotes) {
                habitNotes[habit.id] = habit.dailyNotes[dayStr] ?: ""
            }
        }
    }

    val activeHabits = habits.filter { !it.isArchived && !it.isDeleted && isScheduledOn(it, day) }
    val archivedHabits = habits.filter { (it.isArchived || it.isDeleted) && isScheduledOn(it, day) }

    val dayRows = (activeHabits + archivedHabits).map { habit ->
        DayRowData(
            habit = habit,
            scheduled = isScheduledOn(habit, day),
            completed = isScheduledOn(habit, day) && habit.completionHistory[dayStr] == true,
            missed = isScheduledOn(habit, day) && habit.completionHistory[dayStr] == false,
            late = dayStr in habit.lateCompletions,
            warning = isScheduledOn(habit, day) && (habit.isDeleted || habit.isArchived) &&
                habit.completionHistory[dayStr] == null
        )
    }
    val scheduledCount = dayRows.count { it.scheduled }
    val doneCount = dayRows.count { it.completed }
    val rate = if (scheduledCount == 0) 0f else doneCount.toFloat() / scheduledCount

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(day.format(DateTimeFormatter.ofPattern("MMM d, yyyy"))) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(paddingValues).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Text(
                    text = "$doneCount of $scheduledCount habits done (${(rate * 100).toInt()}%)",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { journalExpanded = !journalExpanded },
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Journal", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                            Icon(
                                imageVector = if (journalExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                contentDescription = if (journalExpanded) "Collapse" else "Expand",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        AnimatedVisibility(visible = journalExpanded) {
                            Column {
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = journalText,
                                    onValueChange = { journalText = it },
                                    modifier = Modifier.fillMaxWidth(),
                                    minLines = 3,
                                    label = { Text("How was your day?") }
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                                    androidx.compose.material3.TextButton(
                                        onClick = { viewModel.saveJournal(dayStr, journalText) }
                                    ) {
                                        Text("Save")
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (activeHabits.isNotEmpty()) {
                item {
                    Text("Habits", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                }
                dayRows.filter { !it.habit.isArchived && !it.habit.isDeleted }.forEach { row ->
                    item(key = "habit_${row.habit.id}") {
                        HabitRowWithNote(
                            row = row,
                            dayStr = dayStr,
                            isExpanded = expandedHabitId == row.habit.id,
                            onToggleExpand = {
                                expandedHabitId = if (expandedHabitId == row.habit.id) null else row.habit.id
                            },
                            noteText = habitNotes[row.habit.id] ?: "",
                            onNoteChange = { habitNotes[row.habit.id] = it },
                            onSaveNote = { viewModel.saveHabitNote(row.habit.id, dayStr, it) }
                        )
                    }
                }
            }

            if (archivedHabits.isNotEmpty()) {
                item {
                    Text("Archived / Deleted habits", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                }
                dayRows.filter { it.habit.isArchived || it.habit.isDeleted }.forEach { row ->
                    item(key = "archived_${row.habit.id}") {
                        HabitRowWithNote(
                            row = row,
                            dayStr = dayStr,
                            isExpanded = expandedHabitId == row.habit.id,
                            onToggleExpand = {
                                expandedHabitId = if (expandedHabitId == row.habit.id) null else row.habit.id
                            },
                            noteText = habitNotes[row.habit.id] ?: "",
                            onNoteChange = { habitNotes[row.habit.id] = it },
                            onSaveNote = { viewModel.saveHabitNote(row.habit.id, dayStr, it) }
                        )
                    }
                }
            }

            if (dayRows.isEmpty()) {
                item {
                    Text(
                        "No habits scheduled for this day",
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

private data class DayRowData(
    val habit: HabitEntity,
    val scheduled: Boolean,
    val completed: Boolean,
    val missed: Boolean,
    val late: Boolean = false,
    val warning: Boolean = false
)

@Composable
private fun HabitRowWithNote(
    row: DayRowData,
    dayStr: String,
    isExpanded: Boolean,
    onToggleExpand: () -> Unit,
    noteText: String,
    onNoteChange: (String) -> Unit,
    onSaveNote: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onToggleExpand() },
                verticalAlignment = Alignment.CenterVertically
            ) {
                StatusBadge(row)
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(row.habit.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                        when {
                            row.habit.isArchived -> {
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("(A)", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            row.habit.isDeleted -> {
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("(D)", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                    Text(
                        text = frequencyLabel(row.habit),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Text(
                    text = when {
                        !row.scheduled -> "n/a"
                        row.late -> "done late"
                        row.warning -> "unfinished"
                        row.completed -> "done"
                        row.missed -> "missed"
                        else -> "pending"
                    },
                    style = MaterialTheme.typography.labelMedium,
                    color = when {
                        !row.scheduled -> MaterialTheme.colorScheme.onSurfaceVariant
                        row.late -> Color(0xFFB28704)
                        row.warning -> Color(0xFFB28704)
                        row.completed -> MaterialTheme.colorScheme.primary
                        row.missed -> MaterialTheme.colorScheme.error
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
                Spacer(modifier = Modifier.width(4.dp))
                Icon(
                    imageVector = if (isExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                    contentDescription = if (isExpanded) "Collapse" else "Expand",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            AnimatedVisibility(visible = isExpanded) {
                Column {
                    Spacer(modifier = Modifier.height(8.dp))
                    HorizontalDivider()
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = noteText,
                        onValueChange = onNoteChange,
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                        label = { Text("Notes for this day") }
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        androidx.compose.material3.TextButton(
                            onClick = { onSaveNote(noteText) }
                        ) {
                            Text("Save")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusBadge(row: DayRowData) {
    val text: String
    val color: Color
    val bg: Color
    when {
        !row.scheduled -> {
            text = "-"; color = MaterialTheme.colorScheme.onSurfaceVariant; bg = MaterialTheme.colorScheme.surfaceVariant
        }
        row.late -> {
            text = "\u2713 late"; color = Color(0xFF3E2723); bg = Color(0xFFE6B800)
        }
        row.warning -> {
            text = "!"; color = Color(0xFF3E2723); bg = Color(0xFFE6B800)
        }
        row.completed -> {
            text = "\u2713"; color = MaterialTheme.colorScheme.onPrimary; bg = MaterialTheme.colorScheme.primary
        }
        row.missed -> {
            text = "\u2717"; color = MaterialTheme.colorScheme.onError; bg = MaterialTheme.colorScheme.error
        }
        else -> {
            text = "\u00B7"; color = MaterialTheme.colorScheme.onSurfaceVariant; bg = MaterialTheme.colorScheme.surfaceVariant
        }
    }
    Box(
        modifier = Modifier
            .height(28.dp)
            .widthIn(min = 28.dp)
            .clip(CircleShape)
            .background(bg)
            .padding(horizontal = if (row.late) 8.dp else 0.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text, style = MaterialTheme.typography.labelMedium, color = color, maxLines = 1)
    }
}
