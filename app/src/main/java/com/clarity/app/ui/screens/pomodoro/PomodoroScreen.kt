package com.clarity.app.ui.screens.pomodoro

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.ui.viewmodel.PomodoroViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PomodoroScreen(
    focusSessionId: Long = 0L,
    onBack: () -> Unit = {},
    viewModel: PomodoroViewModel = hiltViewModel()
) {
    LaunchedEffect(focusSessionId) {
        viewModel.loadSession(focusSessionId)
    }

    val state by viewModel.state.collectAsStateWithLifecycle()
    val totalSeconds = if (state.isBreak) state.breakDurationMinutes * 60 else state.focusDurationMinutes * 60
    val progress = if (totalSeconds > 0) (totalSeconds - state.timeLeftSeconds).toFloat() / totalSeconds else 0f
    var showAddDistractionDialog by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    val context = LocalContext.current

    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    val configuration = LocalContext.current.resources.configuration
    val screenWidthDp = configuration.screenWidthDp
    val timerSizeDp = (screenWidthDp * 0.40f).toInt().coerceIn(100, 240)
    val timerSize = timerSizeDp.dp
    val timerFontSizeSp = (screenWidthDp * 0.10f).toInt().coerceIn(24, 48)
    val timerFontSize = timerFontSizeSp.sp

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.title.ifBlank { "Pomodoro" }) },
                navigationIcon = {
                    IconButton(onClick = {
                        viewModel.stopAlarm()
                        onBack()
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = if (state.isBreak) "Break Time" else "Focus Time",
                style = MaterialTheme.typography.headlineSmall,
                color = if (state.isBreak) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(8.dp))

            Box(contentAlignment = Alignment.Center) {
                CircularProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.size(timerSize),
                    strokeWidth = 10.dp,
                    color = if (state.isBreak) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.primary,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant
                )
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = String.format("%02d:%02d", state.timeLeftSeconds / 60, state.timeLeftSeconds % 60),
                        fontSize = timerFontSize,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                if (state.isAlarmPlaying) {
                    FloatingActionButton(
                        onClick = { viewModel.dismissAlarm() },
                        containerColor = MaterialTheme.colorScheme.error
                    ) {
                        Icon(Icons.Default.Pause, contentDescription = "Dismiss Alarm")
                    }
                } else if (state.isRunning) {
                    FloatingActionButton(
                        onClick = { viewModel.pauseTimer() },
                        containerColor = MaterialTheme.colorScheme.error
                    ) {
                        Icon(Icons.Default.Pause, contentDescription = "Pause")
                    }
                } else {
                    FloatingActionButton(
                        onClick = { viewModel.startTimer() },
                        containerColor = MaterialTheme.colorScheme.primary
                    ) {
                        Icon(Icons.Default.PlayArrow, contentDescription = if (state.isPaused) "Resume" else "Start")
                    }
                }
                FloatingActionButton(
                    onClick = { viewModel.resetTimer() },
                    containerColor = MaterialTheme.colorScheme.secondaryContainer
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = "Reset")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                    Text(text = "SESSION", style = MaterialTheme.typography.labelLarge)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = "Pomodoro #${state.sessionCount + 1}", style = MaterialTheme.typography.bodyLarge)
                    Text(text = "Today's Focus: ${state.totalFocusMinutes}m", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                    Text(text = "TIMER SETTINGS", style = MaterialTheme.typography.labelLarge)
                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = state.focusInput,
                        onValueChange = { viewModel.setFocusDuration(it) },
                        label = { Text("Focus (min) *") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = state.breakInput,
                        onValueChange = { viewModel.setBreakDuration(it) },
                        label = { Text("Break (min) *") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = "DISTRACTION LOG", style = MaterialTheme.typography.labelLarge)
                        IconButton(onClick = { showAddDistractionDialog = true }) {
                            Icon(Icons.Default.Add, contentDescription = "Add Distraction")
                        }
                    }

                    if (state.distractions.isEmpty()) {
                        Text(
                            text = "No distractions logged",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        LazyColumn(modifier = Modifier.heightIn(max = 150.dp)) {
                            items(state.distractions) { distraction ->
                                Text(
                                    text = "• $distraction",
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.padding(vertical = 2.dp)
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(80.dp))
        }
    }

    if (showAddDistractionDialog) {
        AddDistractionDialog(
            onDismiss = { showAddDistractionDialog = false },
            onConfirm = { distraction ->
                viewModel.logDistraction(distraction)
                showAddDistractionDialog = false
            }
        )
    }
}

@Composable
fun AddDistractionDialog(
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var distraction by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Log Distraction") },
        text = {
            OutlinedTextField(
                value = distraction,
                onValueChange = { distraction = it },
                label = { Text("What distracted you?") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
        },
        confirmButton = {
            TextButton(
                onClick = { if (distraction.isNotBlank()) onConfirm(distraction.trim()) },
                enabled = distraction.isNotBlank()
            ) {
                Text("Log")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
