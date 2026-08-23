package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.HabitEntity
import com.clarity.app.domain.repository.HabitRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import javax.inject.Inject

@HiltViewModel
class HabitViewModel @Inject constructor(
    private val habitRepository: HabitRepository
) : ViewModel() {

    val activeHabits: StateFlow<List<HabitEntity>> = habitRepository.getActiveHabits()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val archivedHabits: StateFlow<List<HabitEntity>> = habitRepository.getArchivedHabits()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val metricsHabits: StateFlow<List<HabitEntity>> = habitRepository.getMetricsHabits()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    private val _selectedHabitId = MutableStateFlow<Long?>(null)

    @OptIn(ExperimentalCoroutinesApi::class)
    val selectedHabit: StateFlow<HabitEntity?> = _selectedHabitId
        .flatMapLatest { id -> if (id != null) habitRepository.getHabitById(id) else flowOf(null) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = null
        )

    fun selectHabit(habitId: Long) { _selectedHabitId.value = habitId }
    fun clearSelection() { _selectedHabitId.value = null }

    init {
        viewModelScope.launch {
            markMissedDays()
        }
    }

    private suspend fun markMissedDays() {
        val habits = habitRepository.getActiveHabits().first()
        habits.forEach { habit ->
            processHabit(habit)
        }
    }

    private suspend fun processHabit(habit: HabitEntity) {
        val today = LocalDate.now()
        val created = Instant.ofEpochMilli(habit.createdAt).atZone(ZoneId.systemDefault()).toLocalDate()
        var cursor = today.minusDays(1)
        for (i in 0 until 30) {
            if (!isScheduledDay(habit, cursor, created)) {
                cursor = cursor.minusDays(1)
                continue
            }
            val dateStr = cursor.toString()
            if (!habit.completionHistory.containsKey(dateStr)) {
                habitRepository.toggleHabitForDate(habit.id, dateStr, false)
            }
            cursor = cursor.minusDays(1)
        }
        checkDeadline(habit, today)
        scheduleDeadlineCheck(habit)
        scheduleEndOfDayCheck(habit)
    }

    private suspend fun checkDeadline(habit: HabitEntity, date: LocalDate) {
        // Deadline habits are intentionally NOT auto-marked at the deadline.
        // The user can still mark them completed (late = yellow warning) up to
        // the end of day; uncompleted deadline habits get marked red at the end
        // of the day like all other habits (see scheduleEndOfDayCheck).
        if (habit.deadlineHour == null || habit.deadlineMinute == null) return
    }

    private fun scheduleDeadlineCheck(habit: HabitEntity) {
        // Intentionally empty: deadline does not mark a habit missed anymore.
    }

    private fun scheduleEndOfDayCheck(habit: HabitEntity) {
        viewModelScope.launch {
            val now = LocalTime.now()
            val endOfDay = LocalTime.of(23, 59, 59)
            if (now.isBefore(endOfDay)) {
                delay(ChronoUnit.MILLIS.between(now, endOfDay))
            }
            val today = LocalDate.now().toString()
            val currentHabit = activeHabits.value.find { it.id == habit.id } ?: return@launch
            if (currentHabit.completionHistory[today] != true) {
                val created = Instant.ofEpochMilli(habit.createdAt).atZone(ZoneId.systemDefault()).toLocalDate()
                if (isScheduledDay(habit, LocalDate.now(), created)) {
                    habitRepository.setHabitMissed(habit.id, today)
                }
            }
        }
    }

    private fun isScheduledDay(habit: HabitEntity, date: LocalDate, created: LocalDate): Boolean {
        if (date.isBefore(created)) return false
        return when {
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

    fun addHabit(habit: HabitEntity) {
        viewModelScope.launch {
            val id = habitRepository.insertHabit(habit)
            processHabit(habit.copy(id = id))
        }
    }

    fun updateHabit(habit: HabitEntity) {
        viewModelScope.launch {
            habitRepository.updateHabit(habit)
            processHabit(habit)
        }
    }

    fun toggleHabitForToday(habitId: Long) {
        viewModelScope.launch {
            val habit = activeHabits.value.find { it.id == habitId } ?: return@launch
            if (habit.isArchived) return@launch
            val today = LocalDate.now().toString()
            val currentCompleted = habit.completionHistory[today] ?: false
            if (!currentCompleted && habit.deadlineHour != null && habit.deadlineMinute != null) {
                val now = LocalTime.now()
                val deadline = LocalTime.of(habit.deadlineHour, habit.deadlineMinute)
                if (now.isAfter(deadline)) {
                    habitRepository.completeHabitLate(habitId, today)
                    return@launch
                }
            }
            habitRepository.toggleHabitForDate(habitId, today, !currentCompleted)
            if (currentCompleted) {
                scheduleEndOfDayCheck(habit)
            }
        }
    }

    fun archiveHabit(habitId: Long) {
        viewModelScope.launch {
            habitRepository.archiveHabit(habitId, System.currentTimeMillis())
        }
    }

    fun unarchiveHabit(habitId: Long) {
        viewModelScope.launch {
            habitRepository.unarchiveHabit(habitId)
        }
    }

    fun deleteHabit(habitId: Long) {
        viewModelScope.launch {
            habitRepository.softDeleteHabit(habitId)
        }
    }
}
