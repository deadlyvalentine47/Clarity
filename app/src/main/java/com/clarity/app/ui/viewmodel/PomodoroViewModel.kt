package com.clarity.app.ui.viewmodel

import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.R
import com.clarity.app.data.local.database.PomodoroFocusSessionDao
import com.clarity.app.data.local.database.PomodoroFocusSessionEntity
import com.clarity.app.data.local.database.PomodoroSessionDao
import com.clarity.app.data.local.database.PomodoroSessionEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PomodoroState(
    val isRunning: Boolean = false,
    val isPaused: Boolean = false,
    val timeLeftSeconds: Int = 25 * 60,
    val isBreak: Boolean = false,
    val sessionCount: Int = 0,
    val totalFocusMinutes: Int = 0,
    val distractions: List<String> = emptyList(),
    val focusDurationMinutes: Int = 25,
    val breakDurationMinutes: Int = 5,
    val isAlarmPlaying: Boolean = false,
    val title: String = "",
    val focusSessionId: Long = 0,
    val focusInput: String = "25",
    val breakInput: String = "5"
)

object PomodoroTimerManager {
    var timerJob: Job? = null
    var state = PomodoroState()
    private val _state = MutableStateFlow(PomodoroState())
    val stateFlow: StateFlow<PomodoroState> = _state.asStateFlow()
    var mediaPlayer: MediaPlayer? = null
    var vibrator: Vibrator? = null

    fun emit() {
        _state.value = state
    }

    fun stopAlarm() {
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null
            vibrator?.cancel()
            vibrator = null
        } catch (_: Exception) {}
    }

    fun releaseMediaPlayer() {
        stopAlarm()
        timerJob?.cancel()
        timerJob = null
    }

    fun syncFromSession(session: PomodoroFocusSessionEntity) {
        if (state.focusSessionId == session.id && (state.isRunning || state.isPaused)) return
        state = PomodoroState(
            title = session.title,
            focusDurationMinutes = session.focusDurationMinutes,
            breakDurationMinutes = session.breakDurationMinutes,
            sessionCount = session.sessionCount,
            totalFocusMinutes = session.totalFocusMinutes,
            distractions = if (session.distractions.isNotBlank()) session.distractions.split(",").map { it.trim() } else emptyList(),
            timeLeftSeconds = session.focusDurationMinutes * 60,
            focusSessionId = session.id,
            focusInput = session.focusDurationMinutes.toString(),
            breakInput = session.breakDurationMinutes.toString()
        )
        emit()
    }

    fun startTimer(coroutineScope: kotlinx.coroutines.CoroutineScope, onComplete: () -> Unit) {
        timerJob?.cancel()
        state = state.copy(isRunning = true, isPaused = false)
        emit()
        timerJob = coroutineScope.launch {
            while (state.timeLeftSeconds > 0) {
                delay(1000)
                state = state.copy(timeLeftSeconds = state.timeLeftSeconds - 1)
                emit()
            }
            onComplete()
        }
    }

    fun pauseTimer() {
        timerJob?.cancel()
        state = state.copy(isRunning = false, isPaused = true)
        emit()
    }

    fun resetTimer() {
        timerJob?.cancel()
        val duration = if (state.isBreak) state.breakDurationMinutes * 60 else state.focusDurationMinutes * 60
        state = state.copy(isRunning = false, isPaused = false, timeLeftSeconds = duration)
        emit()
    }
}

@HiltViewModel
class PomodoroViewModel @Inject constructor(
    private val sessionDao: PomodoroSessionDao,
    private val focusSessionDao: PomodoroFocusSessionDao,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val manager = PomodoroTimerManager
    val state: StateFlow<PomodoroState> = manager.stateFlow

    init {
        manager.emit()
    }

    fun loadSession(sessionId: Long) {
        if (sessionId <= 0) return
        if (manager.state.focusSessionId == sessionId && (manager.state.isRunning || manager.state.isPaused)) {
            manager.emit()
            return
        }
        viewModelScope.launch {
            val session = focusSessionDao.getSessionById(sessionId).firstOrNull()
            session?.let { manager.syncFromSession(it) }
        }
    }

    fun startTimer() {
        val s = manager.state
        if (s.focusDurationMinutes <= 0 || s.breakDurationMinutes <= 0) return
        manager.startTimer(coroutineScope = viewModelScope, onComplete = { onTimerComplete() })
    }

    fun pauseTimer() {
        manager.pauseTimer()
    }

    fun resetTimer() {
        manager.resetTimer()
    }

    fun setFocusDuration(text: String) {
        val num = text.filter { it.isDigit() }.toIntOrNull()
        manager.state = manager.state.copy(focusInput = text)
        if (num != null && num in 1..90) {
            manager.state = manager.state.copy(focusDurationMinutes = num)
            if (!manager.state.isBreak && !manager.state.isRunning && !manager.state.isPaused) {
                manager.state = manager.state.copy(timeLeftSeconds = num * 60)
            }
        }
        manager.emit()
        saveSession()
    }

    fun setBreakDuration(text: String) {
        val num = text.filter { it.isDigit() }.toIntOrNull()
        manager.state = manager.state.copy(breakInput = text)
        if (num != null && num in 1..30) {
            manager.state = manager.state.copy(breakDurationMinutes = num)
            if (manager.state.isBreak && !manager.state.isRunning && !manager.state.isPaused) {
                manager.state = manager.state.copy(timeLeftSeconds = num * 60)
            }
        }
        manager.emit()
        saveSession()
    }

    fun logDistraction(distraction: String) {
        val time = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault()).format(java.util.Date())
        manager.state = manager.state.copy(
            distractions = manager.state.distractions + "$distraction - $time"
        )
        manager.emit()
        saveSession()
    }

    fun dismissAlarm() {
        manager.stopAlarm()
        manager.state = manager.state.copy(isAlarmPlaying = false)
        manager.emit()
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancelAll()
    }

    private fun saveSession() {
        val s = manager.state
        if (s.focusSessionId <= 0) return
        viewModelScope.launch {
            focusSessionDao.updateSession(
                PomodoroFocusSessionEntity(
                    id = s.focusSessionId,
                    title = s.title,
                    focusDurationMinutes = s.focusDurationMinutes,
                    breakDurationMinutes = s.breakDurationMinutes,
                    sessionCount = s.sessionCount,
                    totalFocusMinutes = s.totalFocusMinutes,
                    distractions = s.distractions.joinToString(", "),
                    updatedAt = System.currentTimeMillis()
                )
            )
        }
    }

    private fun onTimerComplete() {
        if (!manager.state.isBreak) {
            val newCount = manager.state.sessionCount + 1
            val duration = manager.state.focusDurationMinutes
            manager.state = manager.state.copy(
                isRunning = false,
                sessionCount = newCount,
                totalFocusMinutes = manager.state.totalFocusMinutes + duration,
                isAlarmPlaying = true,
                isBreak = true,
                timeLeftSeconds = manager.state.breakDurationMinutes * 60
            )
            manager.emit()
            viewModelScope.launch {
                sessionDao.insertSession(PomodoroSessionEntity(duration = duration, type = "Focus"))
            }
            showNotification("Focus session complete!", "Time for a ${manager.state.breakDurationMinutes}-minute break")
        } else {
            manager.state = manager.state.copy(
                isRunning = false,
                isBreak = false,
                timeLeftSeconds = manager.state.focusDurationMinutes * 60,
                isAlarmPlaying = true
            )
            manager.emit()
            showNotification("Break over!", "Ready for another focus session?")
        }
        saveSession()
    }

    private fun showNotification(title: String, message: String) {
        val dismissIntent = android.content.Intent(context, PomodoroAlarmReceiver::class.java)
        val dismissPending = android.app.PendingIntent.getBroadcast(
            context, 0, dismissIntent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )

        val openIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = android.app.PendingIntent.getActivity(
            context, 1, openIntent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, "pomodoro")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setAutoCancel(false)
            .addAction(R.drawable.ic_launcher_foreground, "Dismiss Alarm", dismissPending)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(9999, notification)

        playAlarmSoundLoop()
        vibrateLoop()
    }

    private fun playAlarmSoundLoop() {
        try {
            manager.stopAlarm()
            val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            manager.mediaPlayer = MediaPlayer().apply {
                setDataSource(context, alarmUri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                prepare()
                start()
            }
        } catch (_: Exception) {}
    }

    private fun vibrateLoop() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                manager.vibrator = vm.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                manager.vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            manager.vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 500, 300), 0))
        } catch (_: Exception) {}
    }

    fun stopAlarm() {
        manager.stopAlarm()
    }

    override fun onCleared() {
        saveSession()
        manager.releaseMediaPlayer()
        super.onCleared()
    }
}
