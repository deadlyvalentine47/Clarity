package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.PomodoroFocusSessionEntity
import com.clarity.app.domain.repository.PomodoroRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PomodoroSessionListViewModel @Inject constructor(
    private val pomodoroRepository: PomodoroRepository
) : ViewModel() {

    val sessions: StateFlow<List<PomodoroFocusSessionEntity>> = pomodoroRepository.getAllFocusSessions()
        .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = emptyList())

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    fun createSession(title: String, onCreated: (Long) -> Unit) {
        viewModelScope.launch {
            val id = pomodoroRepository.insertFocusSession(
                PomodoroFocusSessionEntity(title = title)
            )
            onCreated(id)
        }
    }

    fun deleteSession(session: PomodoroFocusSessionEntity) {
        viewModelScope.launch { pomodoroRepository.deleteFocusSession(session) }
    }
}
