package com.clarity.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import dagger.hilt.android.HiltAndroidApp
import timber.log.Timber

@HiltAndroidApp
class ClarityApp : Application() {

    override fun onCreate() {
        super.onCreate()
        Timber.plant(Timber.DebugTree())
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)

            val habitChannel = NotificationChannel(
                "habit_reminders",
                "Habit Reminders",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Reminders for your daily habits"
            }
            nm.createNotificationChannel(habitChannel)

            val quickNoteChannel = NotificationChannel(
                "quick_notes",
                "Quick Notes",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Quick note creation"
            }
            nm.createNotificationChannel(quickNoteChannel)

            val pomodoroChannel = NotificationChannel(
                "pomodoro",
                "Pomodoro Timer",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications when Pomodoro timer completes"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                setBypassDnd(true)
            }
            nm.createNotificationChannel(pomodoroChannel)
        }
    }
}
