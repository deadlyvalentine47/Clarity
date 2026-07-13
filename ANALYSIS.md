# Clarity App - Code Analysis

## Overview
Android personal productivity app (Kotlin, Jetpack Compose, Hilt, Room)
for managing tasks, habits, notes, budget, calendar, goals, and Pomodoro timer.

## Architecture
- Clean Architecture-ish: data/ (DAOs, entities, repos), domain/ (repo interfaces), ui/ (ViewModels, Screens)
- DI: Hilt (SingletonComponent)
- Database: Room 2.6.1, version 6, fallbackToDestructiveMigration
- Navigation: Jetpack Navigation Compose (drawer-based, adaptive for tablets)
- State: StateFlow + collectAsStateWithLifecycle

## Modules Structure
```
com.clarity.app
├── data.local.database   (13 entities, 13 DAOs, TypeConverters, Callback)
├── data.local.datastore   (UserPreferences via DataStore)
├── data.repository        (7 repository implementations)
├── domain.repository      (7 repository interfaces)
├── di                     (DatabaseModule, PreferencesModule, RepositoryModule)
├── ui.navigation          (Sealed Screen routes, NavHost)
├── ui.screens             (home, tasks, budget, calendar, habits, notes, pomodoro, settings)
├── ui.theme               (Color, Theme, Type)
├── ui.viewmodel           (10 ViewModels)
├── ui.components          (DeleteConfirmationDialog)
└── util                   (BootReceiver, DataExportImport, NotificationHelper, Constants)
```

## Fixed Issues (branch: fix/code-review-issues)

### Fixed - Critical
1. **FileProvider** — Added `AndroidManifest.xml` provider + `res/xml/file_paths.xml` for data export
2. **PomodoroTimerManager leaks** — Removed leaking object-level CoroutineScope; timer now uses ViewModel's scope; MediaPlayer/Vibrator released in onCleared
3. **Unbounded coroutines** — All `CoroutineScope(SupervisorJob()+Dispatchers.IO).launch` replaced with `viewModelScope.launch`

### Fixed - Important
4. **Export includes all data** — Added `getAllHabits()` and `getAllGoals()` DAO queries; export now includes archived habits and completed goals
5. **Import clears data first** — Added `deleteAll*()` DAO methods; import now clears existing data before inserting
6. **BudgetViewModel architecture** — Created `BudgetRepository` interface/impl; ViewModel no longer directly injects DAOs
7. **ProGuard rules** — Removed references to non-existent `data.model` and `domain.model` packages

### Fixed - Medium
8. **Redundant Flow combines** — Simplified DashboardViewModel to remove unnecessary `.combine()` calls
9. **Dead flow** — Removed unused `filteredSessions` from PomodoroSessionListViewModel
10. **Named constants** — Created `AppConstants.kt` 
11. **Unused DateUtils.kt** — Deleted
12. **Inconsistent delete dialog** — HabitsScreen now uses shared `DeleteConfirmationDialog`
13. **Export I/O error handling** — Added try-catch around file write

### Reviewed - Not Bugs
- **HabitDao Map<String,Boolean> param** — Room supports TypeConverters for @Query params; this works correctly
- **Calendar day-of-week** — `dayOfWeek.value % 7` correctly maps DayOfWeek (1-7 Mon-Sun) to grid (0-6 Sun-Sat)
