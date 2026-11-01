# Clarity

Personal management app — tasks, habits, budget, notes, goals, calendar and
Pomodoro — running in the browser with `npm run dev`.

This started as a port of the original Android app (Kotlin + Jetpack Compose +
Room); once it reached feature parity the Kotlin sources were removed and this
became the primary implementation. The old code is still in git history.

## Quick start

```bash
npm install
npm run dev
```

Open the printed URL (default <http://localhost:5173>). The dev server binds to
your LAN too, so you can open it on a phone at `http://<your-ip>:5173`.

```bash
npm run build      # production build -> dist/
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit
```

## Stack

| Original Android app | This app |
| --- | --- |
| Jetpack Compose + Material 3 | React 19 + TypeScript, hand-written CSS design system |
| Room 17 entities / DB v17 | Dexie 4 on IndexedDB (`clarity`, schema v2, same fields) |
| Hilt / ViewModels + StateFlow | React hooks + `dexie-react-hooks` live queries |
| DataStore preferences | `localStorage` (`clarity.preferences`) |
| Navigation Compose | React Router |
| Vico charts | CSS/SVG bars |
| — | Capacitor WebView wrapper for the APK (`android/`) |
| AlarmManager / notifications | Web Audio alarm + in-app banner + `navigator.vibrate` |
| Note images in `clarity/pics` | IndexedDB `noteImages`, referenced as `![img:uuid]` |

## Screens

- **Home** — a glanceable dashboard: greeting + date, a progress ring for
  today's tasks and habits, quick actions (add task, add spend, focus, note),
  and configurable collapsible sections for tasks, events, habits, budget,
  notes, goals and focus. Order and visibility come from Settings; collapsed
  sections stay collapsed across reloads. Tasks can be completed and habits
  checked off without leaving the page, undated tasks get their own group, and
  the money card counts card purchases as spending.
- **Tasks** — filters (All / Today / Upcoming / Overdue / Done), search, subtasks,
  priorities, recurring tasks (completing one spawns the next), edit/delete.
- **Calendar** — month grid with event dots, day agenda, add/edit/delete events.
- **Budget** — hub with balances plus four sub-screens:
  - **Accounts** — multi-month/year filter, per-account credit/spend totals,
    expandable history, account detail with month picker and category filter.
  - **Credit Cards** — limits, utilisation, billing-cycle window (day 29–31
    clamps in short months), purchases/credits, and "pay bill" which writes both
    the card payment and the matching bank expense atomically.
  - **Investments** — portfolio value, P&L, allocation by type, month/all scope.
  - **Metrics** — monthly net worth, bank breakdown by account/category, card
    spending, investment summary.
- **Habits** — Today/All/Archived filters, search, frequency (Daily, Weekly,
  Monthly, Alternate, Custom), optional deadline, check-in, streak/best streak,
  archive/restore, soft delete. Detail shows weekly/monthly calendars and per-day
  status/notes; metrics show monthly completion, a day calendar and per-habit
  grids; the day screen has a journal.
- **Notes** — nested pages with expand/collapse, drag-and-drop reorder/nest
  (cycles rejected), search, pinning, tag filters, tag management, markdown
  preview, inline images, delete-with-descendants.
- **Goals** — active/completed tabs, progress, milestones, edit dialog with slider.
- **Pomodoro** — session list, focus/break timer that survives navigation and reload,
  configurable durations, distraction log, alarm.
- **Settings** — username, theme mode (system/light/dark), six colour themes,
  home-section order/toggles, JSON export/import.
- **Onboarding** — restore from a backup or start fresh, then ask for a name.

## Data

Everything is local to the browser profile:

- `clarity` IndexedDB holds tasks, subtasks, habits, notes, note categories,
  note images, transactions, categories, sources, budget limits, goals, events,
  pomodoro sessions, credit cards, credit-card transactions, investments and
  day journals.
- No rows are seeded. Like the Android app, accounts and categories start empty
  and are created by the user, so a fresh database can never contain duplicate
  defaults.
- **Export data** downloads a dated `clarity_export_<date>.json` in the exact
  shape the Android app reads (`ignoreUnknownKeys = true` on both sides).
- **Import data** replaces everything in a single Dexie transaction and remaps
  IDs for subtasks, notes (parent links), card transactions, pomodoro task links
  and bill-payment links. A failed import leaves the previous data intact.
- Note images are binary and are *not* part of a backup (same as Android, where
  they live in `clarity/pics`); importing keeps the images already stored in the
  browser so existing `![img:…]` markers keep working.
- Clearing site data for the origin wipes the database — export first.
- The **port is part of the origin**: `localhost:5173`, `localhost:5174` and
  `http://<your-ip>:5173` each get their own database. If data seems to vanish
  after restarting the dev server, check which port it opened on.

## Differences from the Android app (intentional fixes)

The port fixes upstream bugs instead of reproducing them:

- Duplicate budget screens collapsed into the hub + Accounts/Cards/Investments/
  Metrics flow; dead `BudgetScreen`, `IncomeScreen`, `SpendingScreen`,
  `SourceDetailScreen`, `CCSpendsScreen` and the `BankScreen`/`BanksScreen` split
  are gone.
- Accounts and categories can no longer be duplicated by name; renaming rewrites
  every transaction in the same transaction so totals never drift.
- Deleting an account/card cleans up linked rows and restores balances; deleting
  one card never touches another card's links.
- Billing cycles clamp correctly in short months and label the statement window
  that ends in the selected month.
- The home money card counts credit-card purchases as spending and excludes
  bill payments (a transfer), so it no longer reports ₹0 for card-first users
  or double-counts a purchase when the bill is paid.
- Undated tasks are grouped as "No date" on Home instead of silently
  disappearing from a count that included them.
- Weekly/Monthly habits actually schedule: Weekly is every 7 days from creation,
  Monthly is the same day-of-month (Android treats them like Daily).
- Missed-day backfill only fills gaps and never overwrites recorded data;
  `bestStreak` is computed on every completion change.
- Note drag-and-drop rejects cycles, renumbers `sortOrder` atomically, and
  deleting a page removes its descendants and their images.
- Imports are atomic and ID-remapped; the previous non-atomic import could leave
  half a backup behind.
- Dark mode/theme palettes are tuned for contrast.

## Project layout

```
src/
├── db/          types.ts (entities), db.ts (Dexie schema + migrations),
│                budget.ts, habits.ts, notes.ts, tasks.ts (data operations)
├── lib/         dates, formatting, preferences, themes, export/import, pomodoro store
├── context/     preferences provider (username, theme, home sections)
├── components/  layout, UI primitives, markdown preview
├── screens/     one file per screen; budget/ holds the budget sub-screens
└── styles.css   design tokens + responsive layout
scripts/         Puppeteer smoke suites
```

## Tests

Puppeteer smoke scripts drive headless Chromium (Brave by default) against the
running dev server. They seed demo data through the app's own Dexie module, visit
every route, exercise the main flows, and fail on console errors.

```bash
npm run dev             # in one terminal
npm run smoke           # renders all 20 routes + dark/empty home, screenshots -> /tmp/opencode/clarity-shots
                        # (clears the dev database when it finishes)
npm run smoke:interact  # add task/subtask/transaction, toggle habit, timer, dark mode, onboarding
npm run smoke:logic     # recurrence, streak, billing clamp, card cascade, note tree, export/import
npm run smoke:flows     # account/card/investment CRUD, habit day status, child page, sections, round trip
```

Set `BRAVE_PATH` if your Chromium binary lives somewhere other than `/usr/bin/brave`.

## Android APK

The same app ships as an APK through Capacitor: `android/` is a standard native
project and `npm run build && npx cap sync android` copies `dist/` into it.

The APK is built in GitHub Actions, so no Android SDK or JDK is needed locally.
Every build waits for an approval, then is attached to the rolling
[`apk-latest` release](https://github.com/deadlyvalentine47/Clarity/releases/tag/apk-latest)
as a plain `.apk` (artifacts are always zips, release assets are not):

```
https://github.com/deadlyvalentine47/Clarity/releases/download/apk-latest/clarity-debug.apk
```

- Approve a run in Actions → **Android APK** (PRs to `master` and manual runs
  both stop at the `apk-build` environment).
- Local builds need JDK 17+ and the Android SDK: `npm run android:apk`.

Details — signing secrets, app id, versioning and WebView differences — are in
[`android/README.md`](android/README.md).
