package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.SubtaskEntity
import com.clarity.app.data.local.database.TaskEntity
import com.clarity.app.domain.repository.SubtaskRepository
import com.clarity.app.domain.repository.TaskRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TaskUiState(
    val tasks: List<TaskEntity> = emptyList(),
    val selectedFilter: String = "All",
    val searchQuery: String = "",
    val isLoading: Boolean = false
)

@HiltViewModel
class TaskViewModel @Inject constructor(
    private val taskRepository: TaskRepository,
    private val subtaskRepository: SubtaskRepository
) : ViewModel() {

    private val _selectedFilter = MutableStateFlow("All")
    private val _searchQuery = MutableStateFlow("")

    val uiState: StateFlow<TaskUiState> = combine(
        taskRepository.getAllTasks(),
        _selectedFilter,
        _searchQuery
    ) { tasks, filter, query ->
        val filteredTasks = when (filter) {
            "All" -> tasks
            "Today" -> {
                val now = System.currentTimeMillis()
                val startOfDay = getStartOfDay(now)
                val endOfDay = getEndOfDay(now)
                tasks.filter { it.dueDate in startOfDay..endOfDay && !it.isCompleted }
            }
            "Upcoming" -> tasks.filter { it.dueDate != null && it.dueDate > System.currentTimeMillis() && !it.isCompleted }
            "Overdue" -> tasks.filter { it.dueDate != null && it.dueDate < System.currentTimeMillis() && !it.isCompleted }
            "Done" -> tasks.filter { it.isCompleted }
            else -> tasks
        }.filter {
            if (query.isBlank()) true
            else it.title.contains(query, ignoreCase = true) ||
                    it.description.contains(query, ignoreCase = true)
        }
        TaskUiState(
            tasks = filteredTasks,
            selectedFilter = filter,
            searchQuery = query
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = TaskUiState()
    )

    private val _subtasks = MutableStateFlow<Map<Long, List<SubtaskEntity>>>(emptyMap())
    val subtasks: StateFlow<Map<Long, List<SubtaskEntity>>> = _subtasks.asStateFlow()

    fun setFilter(filter: String) {
        _selectedFilter.value = filter
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun addTask(task: TaskEntity) {
        viewModelScope.launch {
            taskRepository.insertTask(task)
        }
    }

    fun updateTask(task: TaskEntity) {
        viewModelScope.launch {
            taskRepository.updateTask(task)
        }
    }

    fun deleteTask(task: TaskEntity) {
        viewModelScope.launch {
            taskRepository.deleteTask(task)
            subtaskRepository.deleteAllSubtasksForTask(task.id)
        }
    }

    fun toggleTaskCompletion(taskId: Long, isCompleted: Boolean) {
        viewModelScope.launch {
            taskRepository.toggleTaskCompletion(taskId, isCompleted)
            
            // If task is completed and is recurring, create next occurrence
            if (isCompleted) {
                val task = uiState.value.tasks.find { it.id == taskId }
                if (task != null && task.isRecurring && task.recurringType != null) {
                    val nextDueDate = calculateNextDueDate(task.dueDate, task.recurringType)
                    val newTask = task.copy(
                        id = 0,
                        isCompleted = false,
                        dueDate = nextDueDate,
                        createdAt = System.currentTimeMillis(),
                        updatedAt = System.currentTimeMillis()
                    )
                    taskRepository.insertTask(newTask)
                }
            }
        }
    }

    private fun calculateNextDueDate(currentDueDate: Long?, recurringType: String): Long? {
        if (currentDueDate == null) return null
        
        val calendar = java.util.Calendar.getInstance().apply {
            timeInMillis = currentDueDate
        }
        
        when (recurringType) {
            "Daily" -> calendar.add(java.util.Calendar.DAY_OF_MONTH, 1)
            "Weekly" -> calendar.add(java.util.Calendar.WEEK_OF_YEAR, 1)
            "Monthly" -> calendar.add(java.util.Calendar.MONTH, 1)
            "Custom" -> calendar.add(java.util.Calendar.DAY_OF_MONTH, 1) // Default to daily for custom
        }
        
        return calendar.timeInMillis
    }

    fun loadSubtasks(taskId: Long) {
        viewModelScope.launch {
            subtaskRepository.getSubtasksForTask(taskId).collect { subtasksList ->
                _subtasks.value = _subtasks.value + (taskId to subtasksList)
            }
        }
    }

    fun addSubtask(subtask: SubtaskEntity) {
        viewModelScope.launch {
            subtaskRepository.insertSubtask(subtask)
        }
    }

    fun updateSubtask(subtask: SubtaskEntity) {
        viewModelScope.launch {
            subtaskRepository.updateSubtask(subtask)
        }
    }

    fun deleteSubtask(subtask: SubtaskEntity) {
        viewModelScope.launch {
            subtaskRepository.deleteSubtask(subtask)
        }
    }

    fun toggleSubtaskCompletion(subtaskId: Long, isCompleted: Boolean) {
        viewModelScope.launch {
            subtaskRepository.toggleSubtaskCompletion(subtaskId, isCompleted)
        }
    }

    private fun getStartOfDay(timestamp: Long): Long {
        val cal = java.util.Calendar.getInstance().apply {
            timeInMillis = timestamp
            set(java.util.Calendar.HOUR_OF_DAY, 0)
            set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0)
            set(java.util.Calendar.MILLISECOND, 0)
        }
        return cal.timeInMillis
    }

    private fun getEndOfDay(timestamp: Long): Long {
        val cal = java.util.Calendar.getInstance().apply {
            timeInMillis = timestamp
            set(java.util.Calendar.HOUR_OF_DAY, 23)
            set(java.util.Calendar.MINUTE, 59)
            set(java.util.Calendar.SECOND, 59)
            set(java.util.Calendar.MILLISECOND, 999)
        }
        return cal.timeInMillis
    }
}
