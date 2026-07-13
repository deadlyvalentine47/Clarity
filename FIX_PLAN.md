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
| 17 | MEDIUM | Tags UI in task dialog + display + search | `7775c5b` |
| 18 | MEDIUM | Delete category/source shows reference count warning | `7775c5b` |
| 19 | MEDIUM | Centralize notification channels in ClarityApp | `7775c5b` |
| 20 | MEDIUM | Remove unused SCHEDULE_EXACT_ALARM permissions | `7775c5b` |

## Remaining Nice-to-Haves (not critical, user-skipped)
- Extract hardcoded strings ("All", "Today", "High", etc.) into constants/enums
