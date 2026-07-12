package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.PomodoroFocusSessionDao
import com.clarity.app.data.local.database.PomodoroFocusSessionEntity
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
    private val focusSessionDao: PomodoroFocusSessionDao
) : ViewModel() {

    val sessions: StateFlow<List<PomodoroFocusSessionEntity>> = focusSessionDao.getAllSessions()
        .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = emptyList())

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    val filteredSessions: StateFlow<List<PomodoroFocusSessionEntity>> = focusSessionDao.getAllSessions()
        .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = emptyList())

    fun createSession(title: String, onCreated: (Long) -> Unit) {
        viewModelScope.launch {
            val id = focusSessionDao.insertSession(
                PomodoroFocusSessionEntity(title = title)
            )
            onCreated(id)
        }
    }

    fun deleteSession(session: PomodoroFocusSessionEntity) {
        viewModelScope.launch { focusSessionDao.deleteSession(session) }
    }
}
