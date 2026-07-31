package com.clarity.app.ui.screens.habits

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

internal fun habitCreatedDate(habit: HabitEntity): LocalDate =
    Instant.ofEpochMilli(habit.createdAt).atZone(ZoneId.systemDefault()).toLocalDate()

internal fun habitArchivedDate(habit: HabitEntity): LocalDate? =
    if (habit.isArchived && habit.archivedAt != null)
        Instant.ofEpochMilli(habit.archivedAt).atZone(ZoneId.systemDefault()).toLocalDate()
    else null

internal fun habitDeletedDate(habit: HabitEntity): LocalDate? =
    if (habit.isDeleted && habit.deletedAt != null)
        Instant.ofEpochMilli(habit.deletedAt).atZone(ZoneId.systemDefault()).toLocalDate()
    else null

internal fun habitEndDate(habit: HabitEntity): LocalDate? =
    habitArchivedDate(habit) ?: habitDeletedDate(habit)

internal fun isScheduledDayFor(
    frequency: String,
    alternateDays: Int?,
    selectedDays: List<Int>?,
    created: LocalDate,
    date: LocalDate
): Boolean {
    if (date.isBefore(created)) return false
    return when {
        frequency == "Alternate" && alternateDays != null ->
            ChronoUnit.DAYS.between(created, date) % (alternateDays + 1) == 0L
        frequency == "Custom" && selectedDays != null ->
            date.dayOfWeek.value in selectedDays
        else -> true
    }
}

internal fun isHabitActiveOn(habit: HabitEntity, date: LocalDate): Boolean {
    if (date.isBefore(habitCreatedDate(habit))) return false
    val end = habitEndDate(habit)
    if (end != null && date.isAfter(end)) return false
    return true
}

internal fun isHabitAliveInMonth(habit: HabitEntity, ym: YearMonth): Boolean {
    if (habitCreatedDate(habit).isAfter(ym.atEndOfMonth())) return false
    val end = habitEndDate(habit)
    if (end != null && end.isBefore(ym.atDay(1))) return false
    return true
}

internal fun isScheduledOn(habit: HabitEntity, date: LocalDate): Boolean {
    if (!isHabitActiveOn(habit, date)) return false
    return isScheduledDayFor(habit.frequency, habit.alternateDays, habit.selectedDays, habitCreatedDate(habit), date)
}

internal data class HabitMonthStats(
    val habit: HabitEntity,
    val scheduled: Int,
    val completed: Int,
    val missed: Int
) {
    val rate: Float get() = if (scheduled == 0) 0f else completed.toFloat() / scheduled
}

internal fun computeMonthStats(habit: HabitEntity, ym: YearMonth): HabitMonthStats {
    val created = habitCreatedDate(habit)
    val end = habitEndDate(habit)
    val monthStart = ym.atDay(1)
    val monthEnd = ym.atEndOfMonth()
    val start = if (created.isAfter(monthStart)) created else monthStart
    val endDate = minOf(monthEnd, end ?: LocalDate.now())

    var scheduled = 0
    var completed = 0
    var missed = 0
    var cursor = start
    while (!cursor.isAfter(endDate)) {
        if (isScheduledDayFor(habit.frequency, habit.alternateDays, habit.selectedDays, created, cursor)) {
            scheduled++
            when (habit.completionHistory[cursor.toString()]) {
                true -> completed++
                false -> missed++
                else -> {}
            }
        }
        cursor = cursor.plusDays(1)
    }
    return HabitMonthStats(habit, scheduled, completed, missed)
}

internal data class DayCellStats(val scheduled: Int, val done: Int, val missed: Int)

internal fun dayStats(habits: List<HabitEntity>, date: LocalDate): DayCellStats {
    var scheduled = 0
    var done = 0
    var missed = 0
    habits.forEach { habit ->
        if (!isHabitActiveOn(habit, date)) return@forEach
        if (!isScheduledDayFor(habit.frequency, habit.alternateDays, habit.selectedDays, habitCreatedDate(habit), date)) return@forEach
        scheduled++
        when (habit.completionHistory[date.toString()]) {
            true -> done++
            false -> missed++
            else -> {}
        }
    }
    return DayCellStats(scheduled, done, missed)
}

internal fun frequencyLabel(habit: HabitEntity): String = when {
    habit.frequency == "Alternate" && habit.alternateDays != null -> "Every ${habit.alternateDays + 1} days"
    habit.frequency == "Custom" && habit.selectedDays != null -> {
        val dayNames = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
        habit.selectedDays.map { dayNames[it - 1] }.joinToString(", ")
    }
    else -> habit.frequency
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HabitMetricsScreen(
    onBack: () -> Unit = {},
    onDayClick: (String) -> Unit = {},
    viewModel: HabitViewModel = hiltViewModel()
) {
    val habits by viewModel.metricsHabits.collectAsStateWithLifecycle()

    var selectedYear by remember { mutableIntStateOf(YearMonth.now().year) }
    var selectedMonth by remember { mutableIntStateOf(YearMonth.now().monthValue) }
    var monthExpanded by remember { mutableStateOf(false) }
    var yearExpanded by remember { mutableStateOf(false) }
    var selectedTab by remember { mutableStateOf(0) }

    val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    val years = (YearMonth.now().year - 10)..(YearMonth.now().year + 10)
    val ym = YearMonth.of(selectedYear, selectedMonth)

    val monthHabits = remember(habits, selectedYear, selectedMonth) { habits.filter { isHabitAliveInMonth(it, ym) } }
    val monthStats = remember(monthHabits, selectedYear, selectedMonth) { monthHabits.map { computeMonthStats(it, ym) } }
    val totalScheduled = monthStats.sumOf { it.scheduled }
    val totalCompleted = monthStats.sumOf { it.completed }
    val totalMissed = monthStats.sumOf { it.missed }
    val overallRate = if (totalScheduled == 0) 0f else totalCompleted.toFloat() / totalScheduled
    val activeCount = monthHabits.count { !it.isArchived && !it.isDeleted }
    val archivedCount = monthHabits.count { it.isArchived }
    val deletedCount = monthHabits.count { it.isDeleted }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Habit Metrics") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(modifier = Modifier.fillMaxSize().padding(paddingValues)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ExposedDropdownMenuBox(expanded = monthExpanded, onExpandedChange = { monthExpanded = it }) {
                    OutlinedTextField(
                        value = months[selectedMonth - 1],
                        onValueChange = {},
                        readOnly = true,
                        modifier = Modifier.widthIn(min = 80.dp, max = 100.dp).menuAnchor(MenuAnchorType.PrimaryNotEditable),
                        textStyle = MaterialTheme.typography.bodyLarge.copy(textAlign = TextAlign.Center),
                        singleLine = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = monthExpanded) }
                    )
                    ExposedDropdownMenu(expanded = monthExpanded, onDismissRequest = { monthExpanded = false }) {
                        months.forEachIndexed { index, month ->
                            DropdownMenuItem(
                                text = { Text(month) },
                                onClick = { selectedMonth = index + 1; monthExpanded = false }
                            )
                        }
                    }
                }
                ExposedDropdownMenuBox(expanded = yearExpanded, onExpandedChange = { yearExpanded = it }) {
                    OutlinedTextField(
                        value = selectedYear.toString(),
                        onValueChange = {},
                        readOnly = true,
                        modifier = Modifier.widthIn(min = 96.dp, max = 116.dp).menuAnchor(MenuAnchorType.PrimaryNotEditable),
                        textStyle = MaterialTheme.typography.bodyLarge.copy(textAlign = TextAlign.Center),
                        singleLine = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = yearExpanded) }
                    )
                    ExposedDropdownMenu(expanded = yearExpanded, onDismissRequest = { yearExpanded = false }) {
                        years.forEach { year ->
                            DropdownMenuItem(
                                text = { Text(year.toString()) },
                                onClick = { selectedYear = year; yearExpanded = false }
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.weight(1f))
                Text(ym.format(DateTimeFormatter.ofPattern("MMM yyyy")), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }

            TabRow(selectedTabIndex = selectedTab) {
                Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("Month") })
                Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("Habits") })
            }

            when (selectedTab) {
                0 -> MonthTab(
                    habits = monthHabits,
                    stats = monthStats,
                    activeCount = activeCount,
                    archivedCount = archivedCount,
                    deletedCount = deletedCount,
                    totalCompleted = totalCompleted,
                    totalScheduled = totalScheduled,
                    totalMissed = totalMissed,
                    overallRate = overallRate,
                    ym = ym,
                    onDayClick = onDayClick
                )
                else -> HabitsTab(habits = monthHabits, stats = monthStats, ym = ym)
            }
        }
    }
}

@Composable
private fun MonthTab(
    habits: List<HabitEntity>,
    stats: List<HabitMonthStats>,
    activeCount: Int,
    archivedCount: Int,
    deletedCount: Int,
    totalCompleted: Int,
    totalScheduled: Int,
    totalMissed: Int,
    overallRate: Float,
    ym: YearMonth,
    onDayClick: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(16.dp)
    ) {
        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val sub = buildList {
                    if (archivedCount > 0) add("$archivedCount archived")
                    if (deletedCount > 0) add("$deletedCount deleted")
                }.joinToString(", ").let { if (it.isNotEmpty()) "($it)" else "" }
                MetricsStatCard("Habits", activeCount.toString(), sub, MaterialTheme.colorScheme.primary, Modifier.weight(1f))
                MetricsStatCard("Completed", totalCompleted.toString(), "/ $totalScheduled", MaterialTheme.colorScheme.primary, Modifier.weight(1f))
                MetricsStatCard("Rate", "${(overallRate * 100).toInt()}%", "${totalMissed} missed", if (overallRate >= 0.6f) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error, Modifier.weight(1f))
            }
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                    Text("Tap a day for details", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                    Spacer(modifier = Modifier.height(8.dp))
                    AggregateDayGrid(habits = habits, ym = ym, onDayClick = onDayClick)
                    Spacer(modifier = Modifier.height(8.dp))
                    HorizontalDivider()
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                        Text("✓ all done", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                        Text("✗ some missed", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                        Text("- none", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }

        item {
            Text("Monthly Summary", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }

        items(stats, key = { it.habit.id }) { stat ->
            val habit = stat.habit
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(habit.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                            when {
                                habit.isArchived -> {
                                    Spacer(modifier = Modifier.padding(horizontal = 4.dp))
                                    Text("(A)", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                habit.isDeleted -> {
                                    Spacer(modifier = Modifier.padding(horizontal = 4.dp))
                                    Text("(D)", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                                }
                            }
                        }
                        Text(
                            text = "${frequencyLabel(habit)} · Streak ${habit.currentStreak}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        when {
                            habit.isArchived -> {
                                val archived = habitArchivedDate(habit)
                                Text(
                                    text = if (archived != null) "Archived ${archived.format(DateTimeFormatter.ofPattern("MMM d, yyyy"))}" else "Archived",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            habit.isDeleted -> {
                                val deleted = habitDeletedDate(habit)
                                Text(
                                    text = if (deleted != null) "Deleted ${deleted.format(DateTimeFormatter.ofPattern("MMM d, yyyy"))}" else "Deleted",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.error
                                )
                            }
                        }
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = "${stat.completed}/${stat.scheduled}",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "${(stat.rate * 100).toInt()}%",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (stat.rate >= 0.6f) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                        )
                    }
                }
            }
        }

        if (habits.isEmpty()) {
            item {
                Text(
                    "No habits yet",
                    modifier = Modifier.fillMaxWidth().padding(24.dp),
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun MetricsStatCard(label: String, value: String, sub: String, color: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = color)
            Text(sub, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun AggregateDayGrid(
    habits: List<HabitEntity>,
    ym: YearMonth,
    onDayClick: (String) -> Unit
) {
    val monthStart = ym.atDay(1)
    val daysInMonth = ym.lengthOfMonth()
    val firstWeekStart = monthStart.minusDays((monthStart.dayOfWeek.value % 7).toLong())
    val lastWeekStart = ym.atEndOfMonth().minusDays((ym.atEndOfMonth().dayOfWeek.value % 7).toLong())

    Row(modifier = Modifier.fillMaxWidth()) {
        listOf("S", "M", "T", "W", "T", "F", "S").forEach { day ->
            Text(text = day, style = MaterialTheme.typography.labelMedium, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
        }
    }
    Spacer(modifier = Modifier.height(4.dp))

    var weekStart = firstWeekStart
    while (!weekStart.isAfter(lastWeekStart)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            (0 until 7).forEach { offset ->
                val date = weekStart.plusDays(offset.toLong())
                val inMonth = !date.isBefore(monthStart) && date.isBefore(monthStart.plusMonths(1))
                val cell = if (inMonth) dayStats(habits, date) else null
                val isToday = date == LocalDate.now()

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .aspectRatio(1f)
                        .clip(CircleShape)
                        .background(
                            when {
                                cell == null -> MaterialTheme.colorScheme.surface.copy(alpha = 0.3f)
                                cell.missed > 0 -> MaterialTheme.colorScheme.error
                                cell.scheduled > 0 && cell.done == cell.scheduled -> MaterialTheme.colorScheme.primary
                                cell.scheduled > 0 -> MaterialTheme.colorScheme.primaryContainer
                                else -> MaterialTheme.colorScheme.surface
                            }
                        )
                        .clickable(enabled = inMonth) { onDayClick(date.toString()) },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = when {
                            cell == null -> ""
                            cell.scheduled == 0 -> date.dayOfMonth.toString()
                            cell.missed > 0 -> "✗"
                            cell.done == cell.scheduled -> "✓"
                            else -> date.dayOfMonth.toString()
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = when {
                            cell == null -> MaterialTheme.colorScheme.surface
                            cell.missed > 0 -> MaterialTheme.colorScheme.onError
                            cell.scheduled > 0 && cell.done == cell.scheduled -> MaterialTheme.colorScheme.onPrimary
                            else -> MaterialTheme.colorScheme.onSurface
                        }
                    )
                }
            }
        }
        weekStart = weekStart.plusWeeks(1)
    }
}

@Composable
private fun HabitsTab(
    habits: List<HabitEntity>,
    stats: List<HabitMonthStats>,
    ym: YearMonth
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(16.dp)
    ) {
        items(stats, key = { it.habit.id }) { stat ->
            HabitMetricsCard(stat = stat, ym = ym)
        }

        if (habits.isEmpty()) {
            item {
                Text(
                    "No habits yet",
                    modifier = Modifier.fillMaxWidth().padding(24.dp),
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun HabitMetricsCard(stat: HabitMonthStats, ym: YearMonth) {
    val habit = stat.habit
    var expanded by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth().clickable { expanded = !expanded },
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(habit.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                        when {
                            habit.isArchived -> {
                                Spacer(modifier = Modifier.padding(horizontal = 4.dp))
                                Text("(A)", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            habit.isDeleted -> {
                                Spacer(modifier = Modifier.padding(horizontal = 4.dp))
                                Text("(D)", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                    Text(
                        text = "${frequencyLabel(habit)} · Streak ${habit.currentStreak} · Best ${habit.bestStreak}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Text(if (expanded) "▲" else "▼", style = MaterialTheme.typography.titleMedium)
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Completed ${stat.completed}/${stat.scheduled} (${(stat.rate * 100).toInt()}%)",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold
            )
            when {
                habit.isArchived -> {
                    val archived = habitArchivedDate(habit)
                    Text(
                        text = if (archived != null) "Archived ${archived.format(DateTimeFormatter.ofPattern("MMM d, yyyy"))}" else "Archived",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                habit.isDeleted -> {
                    val deleted = habitDeletedDate(habit)
                    Text(
                        text = if (deleted != null) "Deleted ${deleted.format(DateTimeFormatter.ofPattern("MMM d, yyyy"))}" else "Deleted",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }

            AnimatedVisibility(visible = expanded, enter = expandVertically(), exit = shrinkVertically()) {
                Column {
                    Spacer(modifier = Modifier.height(12.dp))
                    HabitMonthGrid(habit = habit, ym = ym)
                }
            }
        }
    }
}

@Composable
private fun HabitMonthGrid(habit: HabitEntity, ym: YearMonth) {
    val created = habitCreatedDate(habit)
    val end = habitEndDate(habit)
    val monthStart = ym.atDay(1)
    val firstWeekStart = monthStart.minusDays((monthStart.dayOfWeek.value % 7).toLong())
    val lastWeekStart = ym.atEndOfMonth().minusDays((ym.atEndOfMonth().dayOfWeek.value % 7).toLong())

    Row(modifier = Modifier.fillMaxWidth()) {
        listOf("S", "M", "T", "W", "T", "F", "S").forEach { day ->
            Text(text = day, style = MaterialTheme.typography.labelMedium, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
        }
    }
    Spacer(modifier = Modifier.height(4.dp))

    var weekStart = firstWeekStart
    while (!weekStart.isAfter(lastWeekStart)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            (0 until 7).forEach { offset ->
                val date = weekStart.plusDays(offset.toLong())
                val inMonth = !date.isBefore(monthStart) && date.isBefore(monthStart.plusMonths(1))
                val isBeforeCreation = date.isBefore(created)
                val isAfterEnd = end != null && date.isAfter(end)
                val isScheduled = inMonth && !isBeforeCreation && !isAfterEnd &&
                    isScheduledDayFor(habit.frequency, habit.alternateDays, habit.selectedDays, created, date)
                val completed = if (isScheduled) habit.completionHistory[date.toString()] else null
                val isToday = date == LocalDate.now()

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .aspectRatio(1f)
                        .clip(CircleShape)
                        .background(
                            when {
                                !inMonth -> MaterialTheme.colorScheme.surface.copy(alpha = 0.3f)
                                isBeforeCreation || isAfterEnd -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
                                completed == true -> MaterialTheme.colorScheme.primary
                                completed == false -> MaterialTheme.colorScheme.error
                                isToday -> MaterialTheme.colorScheme.primaryContainer
                                else -> MaterialTheme.colorScheme.surface
                            }
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = when {
                            !inMonth -> ""
                            isBeforeCreation || isAfterEnd -> "-"
                            completed == true -> "✓"
                            completed == false -> "✗"
                            else -> date.dayOfMonth.toString()
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = when {
                            !inMonth -> MaterialTheme.colorScheme.surface
                            isBeforeCreation || isAfterEnd -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                            completed == true -> MaterialTheme.colorScheme.onPrimary
                            completed == false -> MaterialTheme.colorScheme.onError
                            isToday -> MaterialTheme.colorScheme.onPrimaryContainer
                            else -> MaterialTheme.colorScheme.onSurface
                        }
                    )
                }
            }
        }
        weekStart = weekStart.plusWeeks(1)
    }
}
