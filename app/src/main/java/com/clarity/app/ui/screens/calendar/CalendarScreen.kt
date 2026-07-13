package com.clarity.app.ui.screens.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Schedule

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.clarity.app.data.local.database.EventEntity
import com.clarity.app.ui.components.DeleteConfirmationDialog
import com.clarity.app.ui.viewmodel.CalendarViewModel
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(
    viewModel: CalendarViewModel = hiltViewModel()
) {
    val today = LocalDate.now()
    var selectedDate by remember { mutableStateOf(today) }
    var currentMonth by remember { mutableIntStateOf(today.monthValue) }
    var currentYear by remember { mutableIntStateOf(today.year) }
    var showAddDialog by remember { mutableStateOf(false) }
    var editingEvent by remember { mutableStateOf<EventEntity?>(null) }
    var monthExpanded by remember { mutableStateOf(false) }
    var yearExpanded by remember { mutableStateOf(false) }
    var showAllEvents by remember { mutableStateOf(false) }
    val events by viewModel.allEvents.collectAsStateWithLifecycle()

    val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    val years = (today.year - 100)..(today.year + 100)

    if (showAllEvents) {
        DayEventsScreen(
            date = selectedDate,
            events = viewModel.getEventsForDay(selectedDate),
            onBack = { showAllEvents = false },
            onEdit = { editingEvent = it },
            onDelete = { viewModel.deleteEvent(it) }
        )
    } else {

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add Event")
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ExposedDropdownMenuBox(
                        expanded = monthExpanded,
                        onExpandedChange = { monthExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = months[currentMonth - 1],
                            onValueChange = {},
                            readOnly = true,
                            modifier = Modifier
                                .widthIn(min = 70.dp, max = 100.dp)
                                .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                            textStyle = MaterialTheme.typography.bodyLarge.copy(textAlign = TextAlign.Center),
                            singleLine = true
                        )
                        ExposedDropdownMenu(
                            expanded = monthExpanded,
                            onDismissRequest = { monthExpanded = false }
                        ) {
                            months.forEachIndexed { index, month ->
                                DropdownMenuItem(
                                    text = { Text(month) },
                                    onClick = {
                                        currentMonth = index + 1
                                        monthExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.size(4.dp))

                    ExposedDropdownMenuBox(
                        expanded = yearExpanded,
                        onExpandedChange = { yearExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = currentYear.toString(),
                            onValueChange = {},
                            readOnly = true,
                            modifier = Modifier
                                .widthIn(min = 70.dp, max = 100.dp)
                                .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                            textStyle = MaterialTheme.typography.bodyLarge.copy(textAlign = TextAlign.Center),
                            singleLine = true
                        )
                        ExposedDropdownMenu(
                            expanded = yearExpanded,
                            onDismissRequest = { yearExpanded = false }
                        ) {
                            years.forEach { year ->
                                DropdownMenuItem(
                                    text = { Text(year.toString()) },
                                    onClick = {
                                        currentYear = year
                                        yearExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                TextButton(onClick = {
                    currentMonth = today.monthValue
                    currentYear = today.year
                    selectedDate = today
                }) {
                    Icon(Icons.Default.DateRange, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.size(4.dp))
                    Text("Today")
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = {
                    if (currentMonth == 1) { currentMonth = 12; currentYear-- }
                    else currentMonth--
                }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Previous")
                }

                Text(
                    text = YearMonth.of(currentYear, currentMonth).format(DateTimeFormatter.ofPattern("MMMM yyyy")),
                    style = MaterialTheme.typography.titleMedium
                )

                IconButton(onClick = {
                    if (currentMonth == 12) { currentMonth = 1; currentYear++ }
                    else currentMonth++
                }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "Next")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                listOf("S", "M", "T", "W", "T", "F", "S").forEach { day ->
                    Text(text = day, style = MaterialTheme.typography.labelMedium, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            val yearMonth = YearMonth.of(currentYear, currentMonth)
            val daysInMonth = yearMonth.lengthOfMonth()
            val firstDay = yearMonth.atDay(1).dayOfWeek.value % 7

            val rows = (daysInMonth + firstDay + 6) / 7
            for (row in 0 until rows) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    for (col in 0..6) {
                        val dayIndex = row * 7 + col - firstDay + 1
                        if (dayIndex in 1..daysInMonth) {
                            val date = yearMonth.atDay(dayIndex)
                            val isToday = date == today
                            val isSelected = date == selectedDate
                            val hasEvents = events.any {
                                val eventDate = java.time.Instant.ofEpochMilli(it.startDate).atZone(ZoneId.systemDefault()).toLocalDate()
                                eventDate == date
                            }

                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .aspectRatio(1f)
                                    .clip(CircleShape)
                                    .background(
                                        when {
                                            isSelected -> MaterialTheme.colorScheme.primary
                                            isToday -> MaterialTheme.colorScheme.primaryContainer
                                            else -> MaterialTheme.colorScheme.surface
                                        }
                                    )
                                    .clickable { selectedDate = date },
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        text = dayIndex.toString(),
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = when {
                                            isSelected -> MaterialTheme.colorScheme.onPrimary
                                            isToday -> MaterialTheme.colorScheme.onPrimaryContainer
                                            else -> MaterialTheme.colorScheme.onSurface
                                        }
                                    )
                                    if (hasEvents) {
                                        Box(
                                            modifier = Modifier
                                                .size(4.dp)
                                                .clip(CircleShape)
                                                .background(
                                                    if (isSelected) MaterialTheme.colorScheme.onPrimary
                                                    else MaterialTheme.colorScheme.primary
                                                )
                                        )
                                    }
                                }
                            }
                        } else {
                            Spacer(modifier = Modifier.weight(1f))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
            val dayEvents = viewModel.getEventsForDay(selectedDate)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "SCHEDULED FOR ${selectedDate.format(DateTimeFormatter.ofPattern("MMM d")).uppercase()}",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (dayEvents.size > 3) {
                    TextButton(onClick = { showAllEvents = true }) {
                        Text("View all ${dayEvents.size} events")
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))

            if (dayEvents.isEmpty()) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Text(text = "No events", modifier = Modifier.padding(16.dp), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                val visibleEvents = dayEvents.take(3)
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(visibleEvents, key = { it.id }) { event ->
                        EventItem(
                            event = event,
                            onEdit = { editingEvent = event },
                            onDelete = { viewModel.deleteEvent(event) }
                        )
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        AddEditEventDialog(
            selectedDate = selectedDate,
            onDismiss = { showAddDialog = false },
            onConfirm = { event -> viewModel.addEvent(event); showAddDialog = false }
        )
    }

    if (editingEvent != null) {
        AddEditEventDialog(
            event = editingEvent!!,
            selectedDate = selectedDate,
            onDismiss = { editingEvent = null },
            onConfirm = { event -> viewModel.updateEvent(event); editingEvent = null }
        )
    }

    } // end of if (!showAllEvents)
}

@Composable
fun EventItem(
    event: EventEntity,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    var showDeleteDialog by remember { mutableStateOf(false) }

    if (showDeleteDialog) {
        DeleteConfirmationDialog(
            title = "Delete Event",
            message = "Are you sure you want to delete \"${event.title}\"?",
            onConfirm = {
                onDelete()
                showDeleteDialog = false
            },
            onDismiss = { showDeleteDialog = false }
        )
    }

    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = event.title, style = MaterialTheme.typography.bodyLarge)
                if (event.description.isNotBlank()) {
                    Text(text = event.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault()).format(java.util.Date(event.startDate)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                IconButton(onClick = onEdit, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Edit, contentDescription = "Edit", modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                IconButton(onClick = { showDeleteDialog = true }, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete", modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddEditEventDialog(
    event: EventEntity? = null,
    selectedDate: LocalDate,
    onDismiss: () -> Unit,
    onConfirm: (EventEntity) -> Unit
) {
    var title by remember { mutableStateOf(event?.title ?: "") }
    var description by remember { mutableStateOf(event?.description ?: "") }
    var category by remember { mutableStateOf(event?.category ?: "") }
    var color by remember { mutableStateOf(event?.color ?: "") }
    var isAllDay by remember { mutableStateOf(event?.isAllDay ?: false) }
    var startHour by remember { mutableIntStateOf(9) }
    var startMinute by remember { mutableIntStateOf(0) }
    var endHour by remember { mutableIntStateOf(10) }
    var endMinute by remember { mutableIntStateOf(0) }
    var reminderIndex by remember { mutableIntStateOf(0) }
    val isEditing = event != null
    val colorOptions = listOf("", "Red", "Blue", "Green", "Orange", "Purple", "Pink", "Teal")
    val reminderOptions = listOf("None", "5 min", "15 min", "30 min", "1 hour")
    val reminderMillis = listOf(0L, 300_000L, 900_000L, 1_800_000L, 3_600_000L)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (isEditing) "Edit Event" else "Add Event") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Title *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
                OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Category") }, modifier = Modifier.fillMaxWidth(), singleLine = true)

                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("All Day", style = MaterialTheme.typography.bodyMedium)
                    Switch(checked = isAllDay, onCheckedChange = { isAllDay = it })
                }

                if (!isAllDay) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("Start:", style = MaterialTheme.typography.bodySmall)
                        ExposedDropdownMenuBox(expanded = false, onExpandedChange = {}) {
                            OutlinedTextField(
                                value = "${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}",
                                onValueChange = {},
                                modifier = Modifier.width(100.dp),
                                readOnly = true,
                                singleLine = true
                            )
                        }
                        Text("End:", style = MaterialTheme.typography.bodySmall)
                        ExposedDropdownMenuBox(expanded = false, onExpandedChange = {}) {
                            OutlinedTextField(
                                value = "${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}",
                                onValueChange = {},
                                modifier = Modifier.width(100.dp),
                                readOnly = true,
                                singleLine = true
                            )
                        }
                    }
                }

                Text("Color", style = MaterialTheme.typography.bodyMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    colorOptions.forEach { c ->
                        FilterChip(
                            selected = color == c,
                            onClick = { color = if (color == c) "" else c },
                            label = { Text(c.ifEmpty { "None" }, style = MaterialTheme.typography.labelSmall) }
                        )
                    }
                }

                var reminderExpanded by remember { mutableStateOf(false) }
                Box {
                    OutlinedTextField(
                        value = reminderOptions[reminderIndex],
                        onValueChange = {},
                        label = { Text("Reminder") },
                        modifier = Modifier.fillMaxWidth(),
                        readOnly = true,
                        singleLine = true
                    )
                    DropdownMenu(expanded = reminderExpanded, onDismissRequest = { reminderExpanded = false }) {
                        reminderOptions.forEachIndexed { index, option ->
                            DropdownMenuItem(
                                text = { Text(option) },
                                onClick = { reminderIndex = index; reminderExpanded = false }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (title.isNotBlank()) {
                        val startMillis = if (isAllDay) {
                            selectedDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                        } else {
                            selectedDate.atTime(startHour, startMinute).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                        }
                        val endMillis = if (isAllDay) {
                            selectedDate.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                        } else {
                            selectedDate.atTime(endHour, endMinute).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                        }
                        if (isEditing) {
                            onConfirm(event!!.copy(
                                title = title.trim(), description = description.trim(),
                                category = category.trim(), color = color,
                                isAllDay = isAllDay, startDate = startMillis, endDate = endMillis,
                                reminderTime = if (reminderIndex > 0) reminderMillis[reminderIndex] else null
                            ))
                        } else {
                            onConfirm(EventEntity(
                                title = title.trim(), description = description.trim(),
                                category = category.trim(), color = color,
                                isAllDay = isAllDay, startDate = startMillis, endDate = endMillis,
                                reminderTime = if (reminderIndex > 0) reminderMillis[reminderIndex] else null
                            ))
                        }
                    }
                },
                enabled = title.isNotBlank()
            ) { Text(if (isEditing) "Save" else "Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DayEventsScreen(
    date: LocalDate,
    events: List<EventEntity>,
    onBack: () -> Unit,
    onEdit: (EventEntity) -> Unit,
    onDelete: (EventEntity) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(date.format(DateTimeFormatter.ofPattern("EEEE, MMM d, yyyy"))) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        if (events.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Text("No events for this day", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(events, key = { it.id }) { event ->
                    EventItem(
                        event = event,
                        onEdit = { onEdit(event) },
                        onDelete = { onDelete(event) }
                    )
                }
            }
        }
    }
}
