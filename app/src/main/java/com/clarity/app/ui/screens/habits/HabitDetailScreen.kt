package com.clarity.app.ui.screens.habits

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HabitDetailScreen(
    habitId: Long,
    onBack: () -> Unit,
    viewModel: HabitViewModel = hiltViewModel()
) {
    viewModel.selectHabit(habitId)
    val habit by viewModel.selectedHabit.collectAsStateWithLifecycle()

    val currentHabit = habit ?: return

    var periodFilter by remember { mutableStateOf("Weekly") }
    val periodOptions = listOf("Weekly", "Monthly")

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(currentHabit.name) },
                navigationIcon = {
                    IconButton(onClick = {
                        viewModel.clearSelection()
                        onBack()
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
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
                HabitInfoCard(currentHabit)
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    periodOptions.forEach { period ->
                        FilterChip(
                            selected = periodFilter == period,
                            onClick = { periodFilter = period },
                            label = { Text(period) }
                        )
                    }
                }
            }

            item {
                MetricsSection(currentHabit, periodFilter)
            }
        }
    }
}

@Composable
private fun HabitInfoCard(habit: HabitEntity) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            if (habit.description.isNotBlank()) {
                Text(
                    text = habit.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(8.dp))
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                StatItem(label = "Frequency", value = when {
                    habit.frequency == "Alternate" && habit.alternateDays != null -> "Every ${habit.alternateDays + 1} days"
                    habit.frequency == "Custom" && habit.selectedDays != null -> {
                        val dayNames = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
                        habit.selectedDays.map { dayNames[it - 1] }.joinToString(", ")
                    }
                    else -> habit.frequency
                })
                StatItem(label = "Streak", value = "${habit.currentStreak} days")
                StatItem(label = "Best", value = "${habit.bestStreak} days")
            }

            if (habit.deadlineHour != null && habit.deadlineMinute != null) {
                Text(
                    text = "Deadline: ${String.format("%02d:%02d", habit.deadlineHour, habit.deadlineMinute)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Created: ${Instant.ofEpochMilli(habit.createdAt).atZone(ZoneId.systemDefault()).toLocalDate().format(DateTimeFormatter.ofPattern("MMM d, yyyy"))}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun StatItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun MetricsSection(habit: HabitEntity, period: String) {
    val today = LocalDate.now()
    val created = Instant.ofEpochMilli(habit.createdAt).atZone(ZoneId.systemDefault()).toLocalDate()
    val archivedDate = if (habit.isArchived && habit.archivedAt != null)
        Instant.ofEpochMilli(habit.archivedAt).atZone(ZoneId.systemDefault()).toLocalDate()
    else null
    val history = habit.completionHistory

    val isScheduledDay: (LocalDate) -> Boolean = { date ->
        when {
            habit.frequency == "Alternate" && habit.alternateDays != null -> {
                val daysSinceCreated = ChronoUnit.DAYS.between(created, date)
                daysSinceCreated % (habit.alternateDays + 1) == 0L
            }
            habit.frequency == "Custom" && habit.selectedDays != null -> {
                date.dayOfWeek.value in habit.selectedDays
            }
            else -> true
        }
    }

    when (period) {
        "Weekly" -> {
            val startWeek = created.minusDays((created.dayOfWeek.value % 7).toLong())
            val todayWeekStart = today.minusDays((today.dayOfWeek.value % 7).toLong())
            val totalWeeks = ((todayWeekStart.toEpochDay() - startWeek.toEpochDay()) / 7).toInt() + 1

            val weeks = (0 until totalWeeks).map { weekOffset ->
                startWeek.plusWeeks(weekOffset.toLong())
            }

            val completedWeeks = weeks.count { weekStart ->
                (0 until 7).all { dayOffset ->
                    val date = weekStart.plusDays(dayOffset.toLong())
                    if (date.isBefore(created)) true
                    else if (archivedDate != null && !date.isBefore(archivedDate)) true
                    else if (!isScheduledDay(date)) true
                    else history[date.toString()] == true
                }
            }

            Text(
                text = "$totalWeeks weeks ($completedWeeks perfect weeks)",
                style = MaterialTheme.typography.titleSmall
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(modifier = Modifier.fillMaxWidth()) {
                listOf("S", "M", "T", "W", "T", "F", "S").forEach { day ->
                    Text(text = day, style = MaterialTheme.typography.labelMedium, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
                }
            }
            Spacer(modifier = Modifier.height(4.dp))

            weeks.forEach { weekStart ->
                Row(modifier = Modifier.fillMaxWidth()) {
                    (0 until 7).forEach { dayOffset ->
                        val date = weekStart.plusDays(dayOffset.toLong())
                        val isBeforeCreation = date.isBefore(created)
                        val isSkipped = !isBeforeCreation && !isScheduledDay(date)
                        val isArchivedDate = archivedDate != null && !date.isBefore(archivedDate)
                        val completed = if (isBeforeCreation || isSkipped || isArchivedDate) null else history[date.toString()]
                        val isLate = completed == true && date.toString() in habit.lateCompletions
                        val isWarning = completed == null && !isBeforeCreation && !isSkipped &&
                            !isArchivedDate && (habit.isDeleted || habit.isArchived)
                        val isToday = date == today

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .aspectRatio(1f)
                                .clip(CircleShape)
                                .background(
                                    when {
                                        isBeforeCreation || isSkipped -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
                                        isArchivedDate -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                                        completed == false -> MaterialTheme.colorScheme.error
                                        isLate || isWarning -> Color(0xFFE6B800)
                                        completed == true -> MaterialTheme.colorScheme.primary
                                        isToday -> MaterialTheme.colorScheme.primaryContainer
                                        else -> MaterialTheme.colorScheme.surface
                                    }
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = when {
                                    isBeforeCreation || isSkipped -> "-"
                                    isArchivedDate -> "A"
                                    completed == false -> "✗"
                                    isLate -> "✓*"
                                    isWarning -> "!"
                                    completed == true -> "✓"
                                    else -> date.dayOfMonth.toString()
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = when {
                                    isBeforeCreation || isSkipped -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                                    isArchivedDate -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                                    completed == false -> MaterialTheme.colorScheme.onError
                                    isLate || isWarning -> Color(0xFF3E2723)
                                    completed == true -> MaterialTheme.colorScheme.onPrimary
                                    isToday -> MaterialTheme.colorScheme.onPrimaryContainer
                                    else -> MaterialTheme.colorScheme.onSurface
                                }
                            )
                        }
                    }
                }
            }
        }
        "Monthly" -> {
            val startMonth = created.withDayOfMonth(1)
            val endMonth = today.withDayOfMonth(1)
            val totalMonths = ((endMonth.year - startMonth.year) * 12 + endMonth.monthValue - startMonth.monthValue).toLong() + 1

            val months = (0 until totalMonths.toInt()).map { startMonth.plusMonths(it.toLong()) }

            val perfectMonths = months.count { month ->
                val daysInMonth = month.lengthOfMonth()
                (1..daysInMonth).all { day ->
                    val date = month.withDayOfMonth(day)
                    if (date.isBefore(created)) true
                    else if (archivedDate != null && !date.isBefore(archivedDate)) true
                    else if (!isScheduledDay(date)) true
                    else history[date.toString()] == true
                }
            }

            Text(
                text = "$totalMonths months ($perfectMonths perfect months)",
                style = MaterialTheme.typography.titleSmall
            )
            Spacer(modifier = Modifier.height(8.dp))

            months.forEach { month ->
                val daysInMonth = month.lengthOfMonth()

                Text(
                    text = month.format(DateTimeFormatter.ofPattern("MMMM yyyy")),
                    style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.padding(vertical = 4.dp)
                )

                Row(modifier = Modifier.fillMaxWidth()) {
                    listOf("S", "M", "T", "W", "T", "F", "S").forEach { day ->
                        Text(text = day, style = MaterialTheme.typography.labelMedium, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))

                val firstDayOfMonth = month.withDayOfMonth(1)
                val lastDayOfMonth = month.withDayOfMonth(daysInMonth)
                val firstWeekStart = firstDayOfMonth.minusDays((firstDayOfMonth.dayOfWeek.value % 7).toLong())
                val lastWeekStart = lastDayOfMonth.minusDays((lastDayOfMonth.dayOfWeek.value % 7).toLong())

                var currentWeekStart = firstWeekStart
                while (!currentWeekStart.isAfter(lastWeekStart)) {
                    Row(modifier = Modifier.fillMaxWidth()) {
                        (0 until 7).forEach { dayOffset ->
                            val date = currentWeekStart.plusDays(dayOffset.toLong())
                            val isBeforeCreation = date.isBefore(created)
                            val isCurrentMonth = !date.isBefore(firstDayOfMonth) && !date.isAfter(lastDayOfMonth)
                            val isSkipped = isCurrentMonth && !isBeforeCreation && !isScheduledDay(date)
                            val isArchivedDate = archivedDate != null && !date.isBefore(archivedDate)
                            val completed = if (isBeforeCreation || !isCurrentMonth || isSkipped || isArchivedDate) null else history[date.toString()]
                            val isLate = completed == true && date.toString() in habit.lateCompletions
                            val isWarning = completed == null && !isBeforeCreation && isCurrentMonth &&
                                !isSkipped && !isArchivedDate && (habit.isDeleted || habit.isArchived)
                            val isToday = date == today

                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .aspectRatio(1f)
                                    .clip(CircleShape)
                                    .background(
                                        when {
                                            !isCurrentMonth -> MaterialTheme.colorScheme.surface.copy(alpha = 0.3f)
                                            isBeforeCreation || isSkipped -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
                                            isArchivedDate -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                                            completed == false -> MaterialTheme.colorScheme.error
                                            isLate || isWarning -> Color(0xFFE6B800)
                                            completed == true -> MaterialTheme.colorScheme.primary
                                            isToday -> MaterialTheme.colorScheme.primaryContainer
                                            else -> MaterialTheme.colorScheme.surface
                                        }
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = when {
                                        !isCurrentMonth -> ""
                                        isBeforeCreation || isSkipped -> "-"
                                        isArchivedDate -> "A"
                                        completed == false -> "✗"
                                        isLate || isWarning -> if (isLate) "✓*" else "!"
                                        completed == true -> "✓"
                                        else -> date.dayOfMonth.toString()
                                    },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = when {
                                        !isCurrentMonth -> MaterialTheme.colorScheme.surface
                                        isBeforeCreation || isSkipped -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                                        isArchivedDate -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                                        completed == false -> MaterialTheme.colorScheme.onError
                                        isLate || isWarning -> Color(0xFF3E2723)
                                        completed == true -> MaterialTheme.colorScheme.onPrimary
                                        isToday -> MaterialTheme.colorScheme.onPrimaryContainer
                                        else -> MaterialTheme.colorScheme.onSurface
                                    }
                                )
                            }
                        }
                    }
                    currentWeekStart = currentWeekStart.plusWeeks(1)
                }

                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}
