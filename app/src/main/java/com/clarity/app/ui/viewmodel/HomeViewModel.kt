package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.datastore.UserPreferences
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val userPreferences: UserPreferences
) : ViewModel() {

    val username: StateFlow<String> = userPreferences.username
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = ""
        )

    val sectionOrder: StateFlow<List<String>> = userPreferences.sectionOrder
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = listOf("Tasks", "Events", "Habits")
        )

    val sectionEnabled: StateFlow<Set<String>> = userPreferences.sectionEnabled
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = setOf("Tasks", "Events", "Habits")
        )

    val isFirstLaunch: StateFlow<Boolean> = userPreferences.isFirstLaunch
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = true
        )

    fun setUsername(name: String) {
        viewModelScope.launch {
            userPreferences.setUsername(name)
        }
    }

    fun setSectionOrder(order: List<String>) {
        viewModelScope.launch {
            userPreferences.setSectionOrder(order)
        }
    }
}
