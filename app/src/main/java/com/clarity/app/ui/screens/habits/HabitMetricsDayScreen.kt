package com.clarity.app.ui.screens.habits

import androidx.compose.foundation.background
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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

            if (activeHabits.isNotEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                            dayRows.filter { !it.habit.isArchived && !it.habit.isDeleted }.forEach { row ->
                                DayRow(row)
                                HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp))
                            }
                        }
                    }
                }
            }

            if (archivedHabits.isNotEmpty()) {
                item {
                    Text("Archived / Deleted habits", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                }
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                            dayRows.filter { it.habit.isArchived || it.habit.isDeleted }.forEach { row ->
                                DayRow(row)
                                HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp))
                            }
                        }
                    }
                }
            }

            if (dayRows.isEmpty()) {
                item {
                    Text(
                        "No habits active on this day",
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
private fun DayRow(row: DayRowData) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
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
            text = "✓ late"; color = Color(0xFF3E2723); bg = Color(0xFFE6B800)
        }
        row.warning -> {
            text = "!"; color = Color(0xFF3E2723); bg = Color(0xFFE6B800)
        }
        row.completed -> {
            text = "✓"; color = MaterialTheme.colorScheme.onPrimary; bg = MaterialTheme.colorScheme.primary
        }
        row.missed -> {
            text = "✗"; color = MaterialTheme.colorScheme.onError; bg = MaterialTheme.colorScheme.error
        }
        else -> {
            text = "·"; color = MaterialTheme.colorScheme.onSurfaceVariant; bg = MaterialTheme.colorScheme.surfaceVariant
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
