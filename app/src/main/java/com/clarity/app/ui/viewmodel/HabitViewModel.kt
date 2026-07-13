package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.HabitEntity
import com.clarity.app.domain.repository.HabitRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
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

    init {
        viewModelScope.launch {
            markMissedDays()
        }
    }

    private suspend fun markMissedDays() {
        val habits = activeHabits.first()
        val today = LocalDate.now()
        habits.forEach { habit ->
            var updated = false
            var cursor = today.minusDays(1)
            for (i in 0 until 30) {
                val dateStr = cursor.toString()
                if (!habit.completionHistory.containsKey(dateStr)) {
                    habitRepository.toggleHabitForDate(habit.id, dateStr, false)
                    updated = true
                }
                cursor = cursor.minusDays(1)
            }
            if (updated) {
                val currentStreak = calculateStreak(habit, today)
                habitRepository.updateHabit(habit.copy(currentStreak = currentStreak))
            }
        }
    }

    private fun calculateStreak(habit: HabitEntity, today: LocalDate): Int {
        var streak = 0
        var cursor = today
        while (true) {
            val dateStr = cursor.toString()
            if (habit.completionHistory[dateStr] == true) {
                streak++
                cursor = cursor.minusDays(1)
            } else {
                break
            }
        }
        return streak
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
            val today = LocalDate.now().toString()
            val habit = activeHabits.value.find { it.id == habitId } ?: return@launch
            val currentCompleted = habit.completionHistory[today] ?: false
            habitRepository.toggleHabitForDate(habitId, today, !currentCompleted)
        }
    }

    fun archiveHabit(habitId: Long) {
        viewModelScope.launch {
            habitRepository.archiveHabit(habitId)
        }
    }

    fun deleteHabit(habit: HabitEntity) {
        viewModelScope.launch {
            habitRepository.deleteHabit(habit)
        }
    }
}
