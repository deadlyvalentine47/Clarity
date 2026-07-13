# Clarity - Fix Plan

## Execution Order (each fix = 1 commit)

### 1. [CRITICAL] Add FileProvider for data export
- Add `<provider>` to AndroidManifest.xml
- Create `res/xml/file_paths.xml`
- Add `xml/file_paths.xml` to the build

### 2. [CRITICAL] Fix HabitDao Map parameter crash
- Convert `updateHabitCompletion` to accept `String` instead of `Map<String, Boolean>`
- Update `toggleHabitForDate` to serialize map before calling
- Update `HabitRepositoryImpl` similarly

### 3. [CRITICAL] Fix PomodoroTimerManager leaks
- Remove object-level CoroutineScope, use ViewModel's scope
- Fix MediaPlayer lifecycle to release on ViewModel onCleared

### 4. [CRITICAL] Fix unbounded coroutines in PomodoroViewModel
- Replace `CoroutineScope(SupervisorJob() + Dispatchers.IO)` with `viewModelScope`

### 5. [IMPORTANT] Fix DataExportImport to include all data
- Export archived habits + completed goals too
- Add `getAllHabits()` and `getAllGoals()` DAO queries

### 6. [IMPORTANT] Fix import to clear before inserting
- Add clear-all DAO methods
- Call them before inserting imported data

### 7. [IMPORTANT] Fix calendar day-of-week calculation
- Correct the modulo formula for Sunday-start calendar

### 8. [IMPORTANT] Fix BudgetViewModel to use repositories
- Add CategoryRepository and SourceRepository interfaces
- Wire them through the repository module

### 9. [IMPORTANT] Fix ProGuard rules
- Remove references to non-existent `data.model` and `domain.model` packages
- Add keep rules for actual serializable classes (ExportTask, etc.)

### 10. [MEDIUM] Fix redundant Flow combines
- Simplify `totalIncome`, `totalExpenses` etc. in BudgetViewModel and DashboardViewModel

### 11. [MEDIUM] Fix PomodoroSessionListViewModel dead flow
- Remove the unused `filteredSessions` StateFlow

### 12. [MEDIUM] Extract hardcoded strings to constants
- Create AppConstants.kt for filter names, priority levels, recurring types

### 13. [MEDIUM] Replace magic numbers with named constants
- Notification IDs, WhileSubscribed timeout, 1 hour millis, etc.

### 14. [MEDIUM] Remove unused DateUtils.kt
- Delete the file (unused across the project)

### 15. [MEDIUM] Fix HabitsScreen to use shared DeleteConfirmationDialog
- Replace inline AlertDialog with DeleteConfirmationDialog component

### 16. [MEDIUM] Add I/O error handling for export
- Wrap file.writeText() in try-catch in SettingsScreen
