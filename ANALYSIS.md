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
└── util                   (BootReceiver, DataExportImport, DateUtils, NotificationHelper)
```

## Known Issues (from code review)

### Critical (crashes)
1. Missing FileProvider for data export
2. HabitDao Map<String, Boolean> param crash in @Query
3. PomodoroTimerManager coroutine + MediaPlayer leak
4. Unbounded coroutine scopes in PomodoroViewModel

### Important
5. Export only exports active/uncompleted entities
6. Import appends instead of replacing data
7. Calendar day-of-week calculation wrong
8. BudgetViewModel bypasses repository layer
9. ProGuard rules reference non-existent packages

### Medium (code quality)
10. Redundant Flow combines in ViewModels
11. Dead filteredSessions flow in PomodoroSessionListViewModel
12. Hardcoded string literals
13. Magic numbers without named constants
14. Unused DateUtils.kt
15. HabitsScreen inconsistent delete confirmation
16. Missing export/import I/O error handling
