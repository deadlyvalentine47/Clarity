# Clarity - Fix Plan (Completed)

## Execution Order (each fix = 1 commit, all pushed to `fix/code-review-issues`)

| # | Severity | Description | Commit |
|---|----------|-------------|--------|
| 1 | CRITICAL | Add FileProvider for data export | `461d4ad` |
| 2 | CRITICAL | ~~HabitDao Map param bug~~ — NOT A BUG (Room handles TypeConverters) | — |
| 3+4 | CRITICAL | Fix PomodoroTimerManager leaks + unbounded coroutines | `720bb40` |
| 5 | IMPORTANT | Export includes archived/completed entities | `c594b1d` |
| 6 | IMPORTANT | Import clears data before restoring | `04a2943` |
| 7 | IMPORTANT | ~~Calendar day-of-week~~ — NOT A BUG (formula is correct) | — |
| 8 | IMPORTANT | BudgetViewModel uses Repository instead of raw DAOs | `7a5937a` |
| 9 | IMPORTANT | Fix ProGuard rules (removed non-existent packages) | `8e943aa` |
| 10-16 | MEDIUM | Code quality: redundant flows, dead flow, constants, unused file, delete dialog, error handling | `f3d7fba` |

## Remaining Nice-to-Haves (not critical)
- Extract hardcoded strings ("All", "Today", "High", etc.) into constants/enums
- Tags field on TaskEntity not exposed in UI
- Delete category/source should check for references
- Notification channels created repeatedly in receivers
- `SCHEDULE_EXACT_ALARM` permission flow for Android 14+
