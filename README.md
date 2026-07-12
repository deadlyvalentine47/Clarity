# Clarity — Personal Management App

A personal management Android app built with Jetpack Compose and Material 3. Manage tasks, habits, budgets, notes, goals, events, and Pomodoro sessions — all stored locally.

## Tech Stack

- **Language:** Kotlin 2.1+
- **UI:** Jetpack Compose + Material 3
- **Architecture:** MVVM + Clean Architecture (presentation / domain / data)
- **DI:** Hilt
- **Database:** Room (SQLite, 13 entities)
- **Preferences:** DataStore
- **Navigation:** Jetpack Navigation Compose
- **Charts:** Vico
- **Background:** WorkManager + AlarmManager

## Setup

### Prerequisites

- Android Studio Ladybug (2024.1.1+) or newer
- JDK 17
- Android SDK 35

### Steps

1. **Clone the repository**  
   `git clone https://github.com/deadlyvalentine47/Clarity.git`

2. **Open in Android Studio**  
   File → Open → select the cloned directory

3. **Sync the project**  
   Wait for Gradle sync to finish. If asked about a Gradle wrapper update, accept it.

4. **Run the app**  
   Select a device/emulator (API 26+) and click Run.

### Building from command line

```bash
./gradlew assembleDebug
```

The debug APK will be at `app/build/outputs/apk/debug/app-debug.apk`.

## Project Structure

```
app/src/main/java/com/clarity/app/
├── data/
│   ├── local/
│   │   ├── database/     # Room entities, DAOs, database class
│   │   └── datastore/    # User preferences
│   └── repository/       # Repository implementations
├── di/                   # Hilt modules
├── domain/
│   └── repository/       # Repository interfaces
├── ui/
│   ├── components/       # Reusable composables
│   ├── navigation/       # Nav graph and routes
│   ├── screens/          # Feature screens
│   ├── theme/            # Colors, typography, theme
│   └── viewmodel/        # ViewModels
└── util/                 # Helpers
```

## Features

- **Tasks** — create, edit, complete, subtasks, recurring, priorities, filters, search
- **Calendar** — month/week/day views, events, color-coded
- **Budget** — income/expense tracking, categories, sources, charts, filters
- **Habits** — daily check-in, streaks, weekly grid, reminders
- **Notes** — rich text with Markdown preview, pinning, categories, search
- **Goals** — short/long-term, milestones, progress slider
- **Pomodoro** — configurable timer, session-based, distraction log, alarm
- **Dashboard** — home screen overview with stats and quick access
- **Settings** — dark mode, data export/import (JSON), username edit
