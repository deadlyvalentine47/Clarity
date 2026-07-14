package com.clarity.app.ui.screens.settings

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.ui.theme.allThemes
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
    val selectedTheme by viewModel.selectedTheme.collectAsStateWithLifecycle()
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

    var showExportDialog by remember { mutableStateOf(false) }
    var exportJson by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(exportState) {
        if (exportState is ExportState.Success) {
            exportJson = (exportState as ExportState.Success).json
            showExportDialog = true
            viewModel.resetExportState()
        }
    }

    if (showExportDialog && exportJson != null) {
        AlertDialog(
            onDismissRequest = { showExportDialog = false; exportJson = null },
            title = { Text("Export Data") },
            text = { Text("How would you like to export your data?") },
            confirmButton = {
                TextButton(onClick = {
                    try {
                        val file = File(context.cacheDir, "clarity_export.json")
                        file.writeText(exportJson!!)
                        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                            type = "application/json"
                            putExtra(Intent.EXTRA_STREAM, uri)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        context.startActivity(Intent.createChooser(shareIntent, "Share Clarity Data"))
                    } catch (e: Exception) {
                        android.widget.Toast.makeText(context, "Share failed: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
                    }
                    showExportDialog = false; exportJson = null
                }) { Text("Share") }
            },
            dismissButton = {
                TextButton(onClick = {
                    try {
                        val downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(
                            android.os.Environment.DIRECTORY_DOWNLOADS
                        )
                        val file = File(downloadsDir, "clarity_export_${System.currentTimeMillis()}.json")
                        file.writeText(exportJson!!)
                        android.widget.Toast.makeText(context, "Saved to Downloads", android.widget.Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        android.widget.Toast.makeText(context, "Save failed: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
                    }
                    showExportDialog = false; exportJson = null
                }) { Text("Save") }
            }
        )
    }

    var profileExpanded by remember { mutableStateOf(true) }
    var appearanceExpanded by remember { mutableStateOf(true) }
    var homePageExpanded by remember { mutableStateOf(true) }
    var dataExpanded by remember { mutableStateOf(true) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { profileExpanded = !profileExpanded },
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "PROFILE",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Icon(
                imageVector = if (profileExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                contentDescription = if (profileExpanded) "Collapse" else "Expand",
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        if (profileExpanded) {
            Spacer(modifier = Modifier.height(8.dp))
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
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { appearanceExpanded = !appearanceExpanded },
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "APPEARANCE",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Icon(
                imageVector = if (appearanceExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                contentDescription = if (appearanceExpanded) "Collapse" else "Expand",
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        if (appearanceExpanded) {
            Spacer(modifier = Modifier.height(8.dp))
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                viewModel.availableThemes.forEach { theme ->
                    val colors = allThemes[theme] ?: return@forEach
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { viewModel.setTheme(theme) }
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .background(colors.primary, CircleShape)
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = theme,
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = if (selectedTheme == theme) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                        if (selectedTheme == theme) {
                            Icon(
                                Icons.Default.Check,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            }
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { homePageExpanded = !homePageExpanded },
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "HOME PAGE",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Icon(
                imageVector = if (homePageExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                contentDescription = if (homePageExpanded) "Collapse" else "Expand",
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        if (homePageExpanded) {
            val sectionOrder by viewModel.sectionOrder.collectAsStateWithLifecycle()
            Spacer(modifier = Modifier.height(8.dp))
            sectionOrder.forEachIndexed { index, section ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(section, style = MaterialTheme.typography.bodyLarge)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        IconButton(
                            onClick = { viewModel.moveSection(section, -1) },
                            enabled = index > 0
                        ) {
                            Icon(Icons.Default.KeyboardArrowUp, "Move up")
                        }
                        IconButton(
                            onClick = { viewModel.moveSection(section, 1) },
                            enabled = index < sectionOrder.size - 1
                        ) {
                            Icon(Icons.Default.KeyboardArrowDown, "Move down")
                        }
                    }
                }
            }
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { dataExpanded = !dataExpanded },
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "DATA",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Icon(
                imageVector = if (dataExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                contentDescription = if (dataExpanded) "Collapse" else "Expand",
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        if (dataExpanded) {
            Spacer(modifier = Modifier.height(8.dp))
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
