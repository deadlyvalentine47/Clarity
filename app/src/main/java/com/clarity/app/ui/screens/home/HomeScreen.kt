package com.clarity.app.ui.screens.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.ui.viewmodel.DashboardViewModel
import com.clarity.app.ui.viewmodel.HomeViewModel
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Calendar
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    homeViewModel: HomeViewModel = hiltViewModel(),
    dashboardViewModel: DashboardViewModel = hiltViewModel(),
    onNavigateToTasks: () -> Unit = {},
    onNavigateToHabits: () -> Unit = {},
    onNavigateToEvents: () -> Unit = {}
) {
    val username by homeViewModel.username.collectAsStateWithLifecycle()
    val todayTasks by dashboardViewModel.todayTasks.collectAsStateWithLifecycle()
    val overdueTasks by dashboardViewModel.overdueTasks.collectAsStateWithLifecycle()
    val upcomingTasks by dashboardViewModel.upcomingTasks.collectAsStateWithLifecycle()
    val activeHabits by dashboardViewModel.activeHabits.collectAsStateWithLifecycle()
    val upcomingEvents by dashboardViewModel.upcomingEvents.collectAsStateWithLifecycle()
    val monthlyExpenses by dashboardViewModel.monthlyExpenses.collectAsStateWithLifecycle()
    val pendingTaskCount by dashboardViewModel.pendingTaskCount.collectAsStateWithLifecycle()
    val habitCount by dashboardViewModel.habitCount.collectAsStateWithLifecycle()

    val sectionOrder by homeViewModel.sectionOrder.collectAsStateWithLifecycle()

    var tasksExpanded by remember { mutableStateOf(true) }
    var todayTasksExpanded by remember { mutableStateOf(true) }
    var overdueTasksExpanded by remember { mutableStateOf(true) }
    var upcomingTasksExpanded by remember { mutableStateOf(true) }
    var habitsExpanded by remember { mutableStateOf(true) }
    var eventsExpanded by remember { mutableStateOf(true) }

    val endOfToday = remember { 
        LocalDate.now().atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
    }
    val filteredUpcomingTasks = remember(upcomingTasks) {
        upcomingTasks.filter { it.dueDate != null && it.dueDate > endOfToday }
    }

    val todayHabits = remember(activeHabits) {
        val today = LocalDate.now()
        activeHabits.filter { habit ->
            when {
                habit.frequency == "Alternate" && habit.alternateDays != null -> {
                    val created = Instant.ofEpochMilli(habit.createdAt).atZone(ZoneId.systemDefault()).toLocalDate()
                    ChronoUnit.DAYS.between(created, today) % (habit.alternateDays + 1) == 0L
                }
                habit.frequency == "Custom" && habit.selectedDays != null -> {
                    today.dayOfWeek.value in habit.selectedDays
                }
                else -> true
            }
        }
    }

    val dateFormat = SimpleDateFormat("EEEE, MMMM d", Locale.getDefault())
    val currentDate = dateFormat.format(Date())
    val greeting = when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
        in 5..11 -> "Good Morning"
        in 12..17 -> "Good Afternoon"
        in 18..21 -> "Good Evening"
        else -> "Good Night"
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Column {
                Text(greeting, style = MaterialTheme.typography.bodySmall)
                Text(username, style = MaterialTheme.typography.headlineMedium)
            }
        }

        item {
            Text(
                text = currentDate,
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(title = "Tasks", value = pendingTaskCount.toString(), modifier = Modifier.weight(1f))
                StatCard(title = "Habits", value = habitCount.toString(), modifier = Modifier.weight(1f))
                StatCard(title = "Spent", value = "\u20B9${String.format("%.0f", monthlyExpenses)}", modifier = Modifier.weight(1f))
            }
        }

        sectionOrder.forEach { section ->
            when (section) {
                "Tasks" -> {
                    item {
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { tasksExpanded = !tasksExpanded },
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Tasks",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "Go to Tasks",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.clickable { onNavigateToTasks() }
                                )
                                Icon(
                                    imageVector = if (tasksExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                    contentDescription = if (tasksExpanded) "Collapse" else "Expand",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }

                    if (tasksExpanded) {
                        item {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { overdueTasksExpanded = !overdueTasksExpanded }
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "OVERDUE (${overdueTasks.size})",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.error
                                )
                                Icon(
                                    imageVector = if (overdueTasksExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                    contentDescription = if (overdueTasksExpanded) "Collapse" else "Expand",
                                    tint = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }

                        if (overdueTasksExpanded) {
                            if (overdueTasks.isEmpty()) {
                                item {
                                    Text(
                                        text = "No overdue tasks",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(start = 8.dp, bottom = 4.dp)
                                    )
                                }
                            } else {
                                items(overdueTasks.take(5)) { task ->
                                    Card(modifier = Modifier.fillMaxWidth()) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(task.title, style = MaterialTheme.typography.bodyLarge)
                                            val priorityColor = when (task.priority) {
                                                "High" -> MaterialTheme.colorScheme.error
                                                "Medium" -> MaterialTheme.colorScheme.tertiary
                                                else -> MaterialTheme.colorScheme.primary
                                            }
                                            Text(
                                                text = task.priority,
                                                style = MaterialTheme.typography.labelSmall,
                                                color = priorityColor,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        item {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { todayTasksExpanded = !todayTasksExpanded }
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "TODAY (${todayTasks.size})",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                Icon(
                                    imageVector = if (todayTasksExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                    contentDescription = if (todayTasksExpanded) "Collapse" else "Expand",
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }

                        if (todayTasksExpanded) {
                            if (todayTasks.isEmpty()) {
                                item {
                                    Text(
                                        text = "No tasks for today",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(start = 8.dp, bottom = 4.dp)
                                    )
                                }
                            } else {
                                items(todayTasks.take(5)) { task ->
                                    Card(modifier = Modifier.fillMaxWidth()) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(task.title, style = MaterialTheme.typography.bodyLarge)
                                            val priorityColor = when (task.priority) {
                                                "High" -> MaterialTheme.colorScheme.error
                                                "Medium" -> MaterialTheme.colorScheme.tertiary
                                                else -> MaterialTheme.colorScheme.primary
                                            }
                                            Text(
                                                text = task.priority,
                                                style = MaterialTheme.typography.labelSmall,
                                                color = priorityColor,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        item {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { upcomingTasksExpanded = !upcomingTasksExpanded }
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "UPCOMING (${filteredUpcomingTasks.size})",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.tertiary
                                )
                                Icon(
                                    imageVector = if (upcomingTasksExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                    contentDescription = if (upcomingTasksExpanded) "Collapse" else "Expand",
                                    tint = MaterialTheme.colorScheme.tertiary,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }

                        if (upcomingTasksExpanded) {
                            if (filteredUpcomingTasks.isEmpty()) {
                                item {
                                    Text(
                                        text = "No upcoming tasks",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(start = 8.dp, bottom = 4.dp)
                                    )
                                }
                            } else {
                                items(filteredUpcomingTasks.take(5)) { task ->
                                    Card(modifier = Modifier.fillMaxWidth()) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(task.title, style = MaterialTheme.typography.bodyLarge)
                                            val priorityColor = when (task.priority) {
                                                "High" -> MaterialTheme.colorScheme.error
                                                "Medium" -> MaterialTheme.colorScheme.tertiary
                                                else -> MaterialTheme.colorScheme.primary
                                            }
                                            Text(
                                                text = task.priority,
                                                style = MaterialTheme.typography.labelSmall,
                                                color = priorityColor,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                "Events" -> {
                    item {
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { eventsExpanded = !eventsExpanded },
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "UPCOMING EVENTS",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "Go to Events",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.clickable { onNavigateToEvents() }
                                )
                                Icon(
                                    imageVector = if (eventsExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                    contentDescription = if (eventsExpanded) "Collapse" else "Expand",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }

                    if (eventsExpanded) {
                        if (upcomingEvents.isEmpty()) {
                            item {
                                Card(modifier = Modifier.fillMaxWidth()) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Text("No upcoming events", style = MaterialTheme.typography.bodyLarge)
                                        Text("Open the menu to add events", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            }
                        } else {
                            items(upcomingEvents.take(5)) { event ->
                                val eventDate = Instant.ofEpochMilli(event.startDate).atZone(ZoneId.systemDefault())
                                val dateText = eventDate.format(DateTimeFormatter.ofPattern("MMM d"))
                                val timeText = if (event.isAllDay) "All day" else eventDate.format(DateTimeFormatter.ofPattern("h:mm a"))
                                Card(modifier = Modifier.fillMaxWidth()) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(12.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(event.title, style = MaterialTheme.typography.bodyLarge)
                                            if (event.description.isNotBlank()) {
                                                Text(
                                                    text = event.description,
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                    maxLines = 1
                                                )
                                            }
                                        }
                                        Column(horizontalAlignment = Alignment.End) {
                                            Text(
                                                text = dateText,
                                                style = MaterialTheme.typography.labelMedium,
                                                color = MaterialTheme.colorScheme.tertiary
                                            )
                                            Text(
                                                text = timeText,
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

                "Habits" -> {
                    item {
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { habitsExpanded = !habitsExpanded },
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "TODAY'S HABITS",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "Go to Habits",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.clickable { onNavigateToHabits() }
                                )
                                Icon(
                                    imageVector = if (habitsExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                    contentDescription = if (habitsExpanded) "Collapse" else "Expand",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }

                    if (habitsExpanded) {
                        if (todayHabits.isEmpty()) {
                            item {
                                Card(modifier = Modifier.fillMaxWidth()) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Text("No habits for today", style = MaterialTheme.typography.bodyLarge)
                                        Text("Open the menu to start tracking", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            }
                        } else {
                            items(todayHabits.take(5)) { habit ->
                                val today = LocalDate.now().toString()
                                val isCompletedToday = habit.completionHistory[today] ?: false
                                Card(modifier = Modifier.fillMaxWidth()) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(12.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(habit.name, style = MaterialTheme.typography.bodyLarge)
                                            Text(
                                                text = if (isCompletedToday) "✓ Done" else "Pending",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = if (isCompletedToday) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                        Text(
                                            text = "🔥 ${habit.currentStreak}",
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = MaterialTheme.colorScheme.tertiary
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

@Composable
fun StatCard(title: String, value: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.headlineLarge,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
            Text(
                text = title,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }
    }
}
