# Clarity — Project Notes

## Task

Port the Android app (Kotlin + Jetpack Compose + Room + Hilt) to a Node/browser app so it can be
run and tested with `npm run dev` instead of Android Studio.

Phase 1 (10 screens) complete. Phase 2: repo pulled ~30 commits ahead (123 files, 18.7k Kotlin LOC)
— porting the budget overhaul, habit metrics/journal, notes tree, home sections, themes and the
larger backup format, while fixing the bugs/duplications in master.

**Status (2026-11-01): port complete; Android sources removed; Node app at repo root.** — 20 app routes + not-found, all four smoke scripts pass with
0 console errors, `tsc --noEmit` and `npm run build` clean.

## Decisions

- Stack: **Vite + React 19 + TypeScript**, IndexedDB via **Dexie 4**, plain CSS design tokens.
- Repo root is the Node app. The Android/Kotlin sources were removed once the port
  reached parity (still in git history / `master`).
- Preferences (username, theme, dark mode, home sections) in `localStorage`; app data in IndexedDB.
- **Consolidate duplicated Android budget screens** into: Budget hub → Accounts (list + detail),
  Credit Cards (list + detail), Investments, Metrics. Drop the dead `BudgetScreen.kt`,
  `IncomeScreen`, `SpendingScreen`, `SourceDetailScreen`, `CCSpendsScreen`, `BankScreen`/
  `BanksScreen` split.
- Fix in the port (not reproduce): duplicate accounts/categories, name-based drift, orphaned card
  transactions, broken billing-cycle dates, CCSpends shared-state bug, stale month caches,
  bestStreak never computed, missed-day backfill overwriting data, sortOrder being write-only,
  note drag-drop cycles, non-atomic import, backup ID remapping, dark-mode contrast.
- Habit Weekly/Monthly are no-ops in Android; web treats Weekly as every 7 days from creation and
  Monthly as the same day-of-month (documented improvement).
- Notes `category` is a comma tag list; web treats it consistently as tags (filter matches any tag).
- Images stored in IndexedDB (`noteImages`) and referenced as `![img:uuid]` (Android uses files).
- No default accounts/categories are seeded (Android doesn't either) — kills the duplicate-defaults
  bug at the root.
- Import skips clearing `noteImages` because backups are JSON-only; local images survive.

## Constraints

- IndexedDB cannot index booleans — filter `isCompleted/isArchived/isPinned/isDefault/isDeleted`
  in JS, never add them to Dexie `stores()`.
- Un-indexed lookups (e.g. `linkedCardTxnId`) must use `collection.filter()`, not `where()` —
  `where()` on a missing index throws `SchemaError` and aborts the whole Dexie transaction.
- Export JSON must stay Android-compatible (extra fields are ignored by its `ignoreUnknownKeys`).
- Import must be atomic (single Dexie transaction) and remap parent/child IDs.
- Node 18+, no Android SDK. Dev server port 5173.
- Smoke scripts import `/src/db/db.ts` through the Vite dev server, so the dev server must run.
  Set `BRAVE_PATH` if Chromium isn't `/usr/bin/brave`.
- In Puppeteer tests, scope dialog clicks to `.dialog`: the page behind it often has same-named
  chips/buttons (e.g. category filter chips vs. category picker).

## Done

- Phase 1: all original screens, data layer, export/import, dark mode, onboarding, smoke tests.
- Phase 2 data layer: Dexie v2 migration, `budget.ts`, `habits.ts`, `notes.ts`, `themes.ts`,
  `prefs.ts`, atomic Android-compatible `exportImport.ts`.
- Phase 2 UI: Budget hub + Accounts/Cards/Investments/Metrics (list + detail), Habits
  (list/detail/metrics/day + journal), Notes tree (drag-drop, images, tags), Home with
  configurable sections, Settings (themes, section order, export/import), Onboarding with import.
- 2026-11-01 fixes found while testing:
  - `deleteTransactionCascade` used `where('linkedCardTxnId')` (no index) → SchemaError; now
    `filter()`. Deleting a transaction restores the account balance again.
  - `deleteCardCascade` nulled every bank payment's card link; now card-scoped and also removes
    bank-side rows pointing at the deleted card.
  - Billing cycle now labels the statement window that *ends* in the selected month and clamps
    day 29–31 in short months.
  - Card "outstanding" clamps to 0 for cards in credit, with the credit shown separately
    (hub, card list, card detail, metrics).
  - Habit metrics day cells no longer draw a "today" ring on every unscheduled day; partial days
    show `done/scheduled`; legend updated.
  - Import keeps `noteImages` so `![img:…]` markers don't break.
  - PageHeader wraps on narrow screens; month/year chip filters wrap instead of scrolling.
  - `plural()` helper removes "1 days" strings.
- Tests: `smoke` (20 routes), `smoke:interact`, `smoke:logic` (recurrence, streak, billing clamp,
  card cascade isolation, note tree cycle guard, rename drift, export/import), `smoke:flows`
  (account/card/investment CRUD, bill payment, habit day status, child page, home quick-add /
  complete / habit chip / collapse persistence, round trip). All green, 0 console errors.
- 2026-11-01 home revamp: hero (date/greeting/today progress ring) + quick actions
  (task, spend, focus, note), section cards with persisted collapse, inline task
  completion and habit check-off, "No date" task group, agenda-style events, money
  card with bank/card split and burn-down bar, compact one-line empty states,
  two-column grid on wide screens. New helpers: `ProgressRing` (ui.tsx),
  `spendSummary`/`isCardPayment` (budget.ts), `formatShortDate`, `plural`.

## Next

- Optional: code-split the bundle (build warns >500 kB) — e.g. lazy-load budget/habits routes.
- Optional: richer charts (Android uses Vico) and a calendar-year heat map.
- Keep `README.md` in sync when screens change.
