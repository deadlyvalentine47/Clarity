package com.clarity.app.ui.screens.habits

import androidx.compose.foundation.background
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
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.data.local.database.HabitEntity
import com.clarity.app.ui.viewmodel.HabitViewModel
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

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

    var periodFilter by remember { mutableStateOf("Daily") }
    val periodOptions = listOf("Daily", "Weekly", "Monthly")

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
                StatItem(label = "Frequency", value = if (habit.frequency == "Alternate" && habit.alternateDays != null)
                    "Every ${habit.alternateDays + 1} days" else habit.frequency)
                StatItem(label = "Streak", value = "${habit.currentStreak} days")
                StatItem(label = "Best", value = "${habit.bestStreak} days")
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
    val history = habit.completionHistory

    when (period) {
        "Daily" -> {
            val startDate = if (created.isAfter(today.minusDays(90))) created else today.minusDays(90)
            val days = (0 until today.toEpochDay().toInt() - startDate.toEpochDay().toInt() + 1)
                .map { startDate.plusDays(it.toLong()) }
            val totalDays = days.size
            val doneDays = days.count { history[it.toString()] == true }
            val hadData = days.count { history.containsKey(it.toString()) }
            val rate = if (hadData > 0) (doneDays.toFloat() / hadData * 100).toInt() else 0

            Text(
                text = "From ${startDate.format(DateTimeFormatter.ofPattern("MMM d"))} ($doneDays/$totalDays done, ${rate}% rate)",
                style = MaterialTheme.typography.titleSmall
            )
            Spacer(modifier = Modifier.height(8.dp))

            LinearProgressIndicator(
                progress = { if (hadData > 0) doneDays.toFloat() / hadData else 0f },
                modifier = Modifier.fillMaxWidth().height(8.dp),
            )

            Spacer(modifier = Modifier.height(8.dp))

            days.reversed().chunked(7).forEach { week ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    week.forEach { date ->
                        val completed = history[date.toString()]
                        Column(
                            modifier = Modifier.weight(1f),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = date.dayOfWeek.name.take(1),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = date.dayOfMonth.toString(),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Box(
                                modifier = Modifier.size(24.dp).clip(CircleShape).background(
                                    when {
                                        completed == true -> MaterialTheme.colorScheme.primary
                                        completed == false -> MaterialTheme.colorScheme.error
                                        else -> MaterialTheme.colorScheme.surfaceVariant
                                    }
                                ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = when {
                                        completed == true -> "✓"
                                        completed == false -> "✗"
                                        else -> "·"
                                    },
                                    fontSize = 12.sp,
                                    color = when {
                                        completed == true -> MaterialTheme.colorScheme.onPrimary
                                        completed == false -> MaterialTheme.colorScheme.onError
                                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
        "Weekly" -> {
            val startWeek = created.with(java.time.DayOfWeek.MONDAY)
            val endWeek = today.with(java.time.DayOfWeek.SUNDAY)
            val totalWeeks =
                ((today.toEpochDay() - startWeek.toEpochDay()) / 7).toInt() + 1

            val weeks = (0 until totalWeeks).map { weekOffset ->
                val s = startWeek.plusWeeks(weekOffset.toLong())
                val e = s.plusDays(6)
                s to e
            }

            val completedWeeks = weeks.count { (s, e) ->
                (0 until 7).all { history[s.plusDays(it.toLong()).toString()] == true }
            }

            Text(
                text = "$totalWeeks weeks (${completedWeeks} perfect weeks)",
                style = MaterialTheme.typography.titleSmall
            )
            Spacer(modifier = Modifier.height(8.dp))

            weeks.forEach { (start, end) ->
                val daysInWeek = (0 until 7).map { start.plusDays(it.toLong()) }
                val doneCount = daysInWeek.count { history[it.toString()] == true }
                val daysWithData = daysInWeek.count { history.containsKey(it.toString()) }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "${start.format(DateTimeFormatter.ofPattern("MMM d"))}",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.width(60.dp)
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        daysInWeek.forEach { date ->
                            val completed = history[date.toString()]
                            Box(
                                modifier = Modifier.size(20.dp).clip(CircleShape).background(
                                    when {
                                        completed == true -> MaterialTheme.colorScheme.primary
                                        completed == false -> MaterialTheme.colorScheme.error
                                        else -> MaterialTheme.colorScheme.surfaceVariant
                                    }
                                ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = when {
                                        completed == true -> "✓"
                                        completed == false -> "✗"
                                        else -> "·"
                                    },
                                    fontSize = 10.sp,
                                    color = when {
                                        completed == true -> MaterialTheme.colorScheme.onPrimary
                                        completed == false -> MaterialTheme.colorScheme.onError
                                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                                    }
                                )
                            }
                        }
                    }
                    Text(
                        text = if (daysWithData > 0) "$doneCount/$daysWithData" else "—",
                        style = MaterialTheme.typography.bodySmall,
                        textAlign = TextAlign.End,
                        modifier = Modifier.width(40.dp)
                    )
                }
            }
        }
        "Monthly" -> {
            val startMonth = created.withDayOfMonth(1)
            val endMonth = today.withDayOfMonth(1)
            val totalMonths =
                ((endMonth.year - startMonth.year) * 12 + endMonth.monthValue - startMonth.monthValue).toLong() + 1

            val months = (0 until totalMonths.toInt()).map { startMonth.plusMonths(it.toLong()) }

            val perfectMonths = months.count { month ->
                val daysInMonth = month.lengthOfMonth()
                (1..daysInMonth).all { history[month.withDayOfMonth(it).toString()] == true }
            }

            Text(
                text = "$totalMonths months (${perfectMonths} perfect months)",
                style = MaterialTheme.typography.titleSmall
            )
            Spacer(modifier = Modifier.height(8.dp))

            months.forEach { month ->
                val daysInMonth = month.lengthOfMonth()
                val doneCount = (1..daysInMonth).count {
                    history[month.withDayOfMonth(it).toString()] == true
                }
                val daysWithData = (1..daysInMonth).count {
                    history.containsKey(month.withDayOfMonth(it).toString())
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = month.format(DateTimeFormatter.ofPattern("MMM yyyy")),
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.width(80.dp)
                    )

                    LinearProgressIndicator(
                        progress = {
                            if (daysWithData > 0) doneCount.toFloat() / daysWithData else 0f
                        },
                        modifier = Modifier.weight(1f).height(8.dp).padding(horizontal = 8.dp),
                    )

                    Text(
                        text = if (daysWithData > 0) "$doneCount/$daysWithData" else "—",
                        style = MaterialTheme.typography.bodySmall,
                        textAlign = TextAlign.End,
                        modifier = Modifier.width(50.dp)
                    )
                }
            }
        }
    }
}
