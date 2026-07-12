package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.EventEntity
import com.clarity.app.domain.repository.EventRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject

@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val eventRepository: EventRepository
) : ViewModel() {

    val allEvents: StateFlow<List<EventEntity>> = eventRepository.getAllEvents()
        .stateIn(scope = viewModelScope, started = SharingStarted.WhileSubscribed(5000), initialValue = emptyList())

    fun addEvent(event: EventEntity) {
        viewModelScope.launch { eventRepository.insertEvent(event) }
    }

    fun updateEvent(event: EventEntity) {
        viewModelScope.launch { eventRepository.updateEvent(event) }
    }

    fun deleteEvent(event: EventEntity) {
        viewModelScope.launch { eventRepository.deleteEvent(event) }
    }

    fun getEventsForDay(date: LocalDate): List<EventEntity> {
        val startOfDay = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val endOfDay = date.atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        return allEvents.value.filter { it.startDate in startOfDay..endOfDay }
    }
}
