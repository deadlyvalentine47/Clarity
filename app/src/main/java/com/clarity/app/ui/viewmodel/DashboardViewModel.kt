package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.HabitEntity
import com.clarity.app.data.local.database.TaskEntity
import com.clarity.app.data.local.database.TransactionEntity
import com.clarity.app.domain.repository.HabitRepository
import com.clarity.app.domain.repository.TaskRepository
import com.clarity.app.domain.repository.TransactionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject

@HiltViewModel
class DashboardViewModel @Inject constructor(
    taskRepository: TaskRepository,
    habitRepository: HabitRepository,
    transactionRepository: TransactionRepository
) : ViewModel() {

    private val today = LocalDate.now()
    private val startOfDay = today.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
    private val endOfDay = today.atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()

    val todayTasks: StateFlow<List<TaskEntity>> = taskRepository.getTodayTasks(startOfDay, endOfDay)
        .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = emptyList())

    val upcomingTasks: StateFlow<List<TaskEntity>> = taskRepository.getPendingTasks()
        .combine(taskRepository.getCompletedTasks()) { pending, _ -> pending }
        .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = emptyList())

    val activeHabits: StateFlow<List<HabitEntity>> = habitRepository.getActiveHabits()
        .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = emptyList())

    val totalExpenses: StateFlow<Double> = transactionRepository.getTotalExpenses()
        .combine(transactionRepository.getTotalIncome()) { expenses, _ -> expenses ?: 0.0 }
        .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = 0.0)

    val pendingTaskCount: StateFlow<Int> = combine(
        taskRepository.getPendingTasks(),
        taskRepository.getCompletedTasks()
    ) { pending, _ -> pending.size }
        .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = 0)

    val habitCount: StateFlow<Int> = habitRepository.getActiveHabits()
        .combine(habitRepository.getArchivedHabits()) { active, _ -> active.size }
        .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = 0)

    val monthlyExpenses: StateFlow<Double> = transactionRepository.getTotalExpenses()
        .combine(transactionRepository.getTotalIncome()) { expenses, _ -> expenses ?: 0.0 }
        .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = 0.0)
}
