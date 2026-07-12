package com.clarity.app.ui.viewmodel

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.datastore.UserPreferences
import com.clarity.app.data.local.database.ClarityDatabase
import com.clarity.app.util.DataExporter
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val userPreferences: UserPreferences,
    private val database: ClarityDatabase,
    @ApplicationContext private val context: Context
) : ViewModel() {

    val username: StateFlow<String> = userPreferences.username
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = ""
        )

    val isDarkMode: StateFlow<Boolean?> = userPreferences.isDarkMode
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = null
        )

    private val _exportState = MutableStateFlow<ExportState>(ExportState.Idle)
    val exportState: StateFlow<ExportState> = _exportState.asStateFlow()

    private val _importState = MutableStateFlow<ImportState>(ImportState.Idle)
    val importState: StateFlow<ImportState> = _importState.asStateFlow()

    fun updateUsername(name: String) {
        viewModelScope.launch {
            userPreferences.setUsername(name)
        }
    }

    fun setDarkMode(enabled: Boolean) {
        viewModelScope.launch {
            userPreferences.setDarkMode(enabled)
        }
    }

    fun exportData() {
        viewModelScope.launch {
            _exportState.value = ExportState.Loading
            try {
                val json = DataExporter.exportToJson(context, database)
                _exportState.value = ExportState.Success(json)
            } catch (e: Exception) {
                _exportState.value = ExportState.Error(e.message ?: "Export failed")
            }
        }
    }

    fun importData(uri: Uri) {
        viewModelScope.launch {
            _importState.value = ImportState.Loading
            try {
                DataExporter.importFromJson(context, database, uri)
                    .onSuccess {
                        _importState.value = ImportState.Success
                    }
                    .onFailure { e ->
                        _importState.value = ImportState.Error(e.message ?: "Import failed")
                    }
            } catch (e: Exception) {
                _importState.value = ImportState.Error(e.message ?: "Import failed")
            }
        }
    }

    fun resetExportState() {
        _exportState.value = ExportState.Idle
    }

    fun resetImportState() {
        _importState.value = ImportState.Idle
    }
}

sealed class ExportState {
    data object Idle : ExportState()
    data object Loading : ExportState()
    data class Success(val json: String) : ExportState()
    data class Error(val message: String) : ExportState()
}

sealed class ImportState {
    data object Idle : ImportState()
    data object Loading : ImportState()
    data object Success : ImportState()
    data class Error(val message: String) : ImportState()
}
