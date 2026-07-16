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
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
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
        val today = LocalDate.now()
        habits.forEach { habit ->
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
        }
    }

    private fun isScheduledDay(habit: HabitEntity, date: LocalDate, created: LocalDate): Boolean {
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
            habitRepository.insertHabit(habit)
        }
    }

    fun updateHabit(habit: HabitEntity) {
        viewModelScope.launch {
            habitRepository.updateHabit(habit)
        }
    }

    fun toggleHabitForToday(habitId: Long) {
        viewModelScope.launch {
            val habit = activeHabits.value.find { it.id == habitId } ?: return@launch
            if (habit.isArchived) return@launch
            val today = LocalDate.now().toString()
            val currentCompleted = habit.completionHistory[today] ?: false
            habitRepository.toggleHabitForDate(habitId, today, !currentCompleted)
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

    fun deleteHabit(habit: HabitEntity) {
        viewModelScope.launch {
            habitRepository.deleteHabit(habit)
        }
    }
}
