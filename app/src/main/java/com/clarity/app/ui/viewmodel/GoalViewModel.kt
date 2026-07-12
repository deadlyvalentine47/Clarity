package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.GoalEntity
import com.clarity.app.domain.repository.GoalRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class GoalViewModel @Inject constructor(
    private val goalRepository: GoalRepository
) : ViewModel() {

    val activeGoals: StateFlow<List<GoalEntity>> = goalRepository.getActiveGoals()
        .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = emptyList())

    val completedGoals: StateFlow<List<GoalEntity>> = goalRepository.getCompletedGoals()
        .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = emptyList())

    fun addGoal(goal: GoalEntity) {
        viewModelScope.launch { goalRepository.insertGoal(goal) }
    }

    fun updateGoal(goal: GoalEntity) {
        viewModelScope.launch { goalRepository.updateGoal(goal) }
    }

    fun deleteGoal(goal: GoalEntity) {
        viewModelScope.launch { goalRepository.deleteGoal(goal) }
    }
}
