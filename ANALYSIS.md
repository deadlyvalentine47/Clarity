# Clarity — Feature Analysis & Issues

Based on manual testing of the entire app, the following gaps and bugs were identified per feature area.

---

## Tasks
- **Search & Filter** ✅ Already implemented (search bar + filter chips: All/Today/Upcoming/Overdue/Done)
- **Swipe delete confirmation** ❌ Swipe deletes immediately without asking — needs `DeleteConfirmationDialog`
- **Recurring task duplicate** ❌ When user un-checks then re-checks a recurring task for today, a duplicate next-occurrence is created. Need to validate whether a future occurrence with the same `recurringType` and `nextDueDate` already exists before inserting

## Habits
- **Missing frequency field** ❌ Add dialog only has name + description; `HabitEntity.frequency` exists but is never set by the user
- **Date tracking tap broken** ❌ Tapping a date on the calendar strip does nothing — remove it; keep only the tick button for today
- **Auto-mark failed days** ❌ No mechanism marks past uncompleted days as "failed"
- **Archive missing** ❌ `archiveHabit()` exists in ViewModel/Repository but is never wired to the UI

## Notes
- **Category is free-text** ❌ Adding a note allows typing a new category name directly, which creates inconsistencies. Should restrict to existing categories only
- **No Markdown preview on tap** ❌ Tapping a note opens directly in edit mode (raw Markdown). Should show rendered preview first, with a separate Edit action

## Goals
- **Milestones use textarea** ❌ Milestones are entered as one-per-line in a multi-line text field. UX would be better with an add-button + popup pattern
- **Progress slider** ❌ Edits allow dragging a progress slider; milestones should be the only progress mechanism. Require at least 1 milestone. Progress = completed/total milestones

## Budget
- **Default categories** ❌ `DatabaseCallback` inserts "Food", "Transport", "Travel" as defaults — remove these; let the user start empty
- **Amount formatting** ❌ No comma-separated Indian number format (`1,23,456.78`)
- **Monthly limit missing** ❌ `BudgetLimitEntity` + ViewModel methods exist, but there is no UI to set/edit/delete monthly limits per category
- **Swipe delete** ❌ Not implemented for transactions (uses delete icon + dialog instead — just confirm dialog works)

## Calendar
- **Event fields too minimal** ❌ Add/Edit dialog only shows Title + Description; missing: category, color, all‑day toggle, start/end time, reminder
- **Year range capped** ❌ Year dropdown limits to `today.year ± 10` (2036 max). Should show all reasonable years

## Settings
- **Export: share vs save** ❌ Export only shares via intent chooser (email/WhatsApp/etc). Need a second option to save directly to the device's Downloads folder
