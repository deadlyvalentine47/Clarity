package com.clarity.app.ui.screens.settings

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.ui.viewmodel.ExportState
import com.clarity.app.ui.viewmodel.ImportState
import com.clarity.app.ui.viewmodel.SettingsViewModel
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val username by viewModel.username.collectAsStateWithLifecycle()
    val isDarkMode by viewModel.isDarkMode.collectAsStateWithLifecycle()
    val exportState by viewModel.exportState.collectAsStateWithLifecycle()
    val importState by viewModel.importState.collectAsStateWithLifecycle()
    var showEditDialog by remember { mutableStateOf(false) }
    var editValue by remember { mutableStateOf("") }
    val context = LocalContext.current

    val importLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        uri?.let { viewModel.importData(it) }
    }

    LaunchedEffect(exportState) {
        if (exportState is ExportState.Success) {
            try {
                val json = (exportState as ExportState.Success).json
                val file = File(context.cacheDir, "clarity_export.json")
                file.writeText(json)
                val uri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    file
                )
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "application/json"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                context.startActivity(Intent.createChooser(shareIntent, "Export Clarity Data"))
            } catch (e: Exception) {
                android.widget.Toast.makeText(context, "Export failed: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
            }
            viewModel.resetExportState()
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "PROFILE",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            ListItem(
                headlineContent = { Text(username.ifEmpty { "Not set" }) },
                supportingContent = { Text("Username") },
                leadingContent = {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = "Username"
                    )
                },
                modifier = Modifier.clickable {
                    editValue = username
                    showEditDialog = true
                }
            )

            HorizontalDivider()

            Text(
                text = "APPEARANCE",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 24.dp, bottom = 8.dp)
            )

            ListItem(
                headlineContent = { Text("Dark Mode") },
                supportingContent = {
                    Text(if (isDarkMode == null) "System default" else if (isDarkMode == true) "On" else "Off")
                },
                trailingContent = {
                    Switch(
                        checked = isDarkMode ?: false,
                        onCheckedChange = { viewModel.setDarkMode(it) }
                    )
                }
            )

            HorizontalDivider()

            Text(
                text = "DATA",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 24.dp, bottom = 8.dp)
            )

            ListItem(
                headlineContent = { Text("Export Data") },
                supportingContent = {
                    when (exportState) {
                        is ExportState.Loading -> Text("Exporting...")
                        else -> Text("Export all data as JSON")
                    }
                },
                trailingContent = {
                    if (exportState is ExportState.Loading) {
                        CircularProgressIndicator()
                    }
                },
                modifier = Modifier.clickable {
                    if (exportState !is ExportState.Loading) {
                        viewModel.exportData()
                    }
                }
            )

            ListItem(
                headlineContent = { Text("Import Data") },
                supportingContent = {
                    when (importState) {
                        is ImportState.Loading -> Text("Importing...")
                        is ImportState.Success -> Text("Import successful!")
                        is ImportState.Error -> Text("Import failed")
                        else -> Text("Import data from JSON")
                    }
                },
                trailingContent = {
                    if (importState is ImportState.Loading) {
                        CircularProgressIndicator()
                    }
                },
                modifier = Modifier.clickable {
                    if (importState !is ImportState.Loading) {
                        importLauncher.launch(arrayOf("application/json"))
                    }
                }
            )
        }
    }

    if (showEditDialog) {
        AlertDialog(
            onDismissRequest = { showEditDialog = false },
            title = { Text("Edit Username") },
            text = {
                OutlinedTextField(
                    value = editValue,
                    onValueChange = { editValue = it },
                    label = { Text("Username") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (editValue.isNotBlank()) {
                            viewModel.updateUsername(editValue.trim())
                        }
                        showEditDialog = false
                    }
                ) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { showEditDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    if (importState is ImportState.Success) {
        AlertDialog(
            onDismissRequest = { viewModel.resetImportState() },
            title = { Text("Import Successful") },
            text = { Text("Your data has been imported successfully.") },
            confirmButton = {
                TextButton(onClick = { viewModel.resetImportState() }) {
                    Text("OK")
                }
            }
        )
    }

    if (importState is ImportState.Error) {
        AlertDialog(
            onDismissRequest = { viewModel.resetImportState() },
            title = { Text("Import Failed") },
            text = { Text((importState as ImportState.Error).message) },
            confirmButton = {
                TextButton(onClick = { viewModel.resetImportState() }) {
                    Text("OK")
                }
            }
        )
    }
}
