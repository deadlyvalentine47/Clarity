package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.HabitEntity
import com.clarity.app.domain.repository.HabitRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
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
