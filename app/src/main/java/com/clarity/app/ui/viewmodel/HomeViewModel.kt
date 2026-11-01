package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.datastore.UserPreferences
import com.clarity.app.data.local.datastore.UserPreferences.Companion.ALL_SECTIONS
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
            initialValue = ALL_SECTIONS
        )

    val sectionEnabled: StateFlow<Set<String>> = userPreferences.sectionEnabled
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = ALL_SECTIONS.toSet()
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
