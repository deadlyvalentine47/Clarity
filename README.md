# Clarity

Personal management app — calendar events (with task fields), habits, budget,
notes, goals and runs — running in the browser with `npm run dev`.

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
| — | Capacitor WebView wrappers for the APK (`android/`) and IPA (`ios/`) |
| AlarmManager / notifications | Web Audio alarm + in-app banner + `navigator.vibrate` |
| Note images in `clarity/pics` | IndexedDB `noteImages`, referenced as `![img:uuid]` |

## Screens

- **Home** — a glanceable dashboard: greeting + date, a progress ring for
  today's events and habits, quick actions (add event, add spend, focus, note),
  and configurable collapsible sections for events, habits, budget, notes, goals
  and focus. Order and visibility come from Settings; collapsed sections stay
  collapsed across reloads. Events can be completed and habits checked off
  without leaving the page, and the money card counts card purchases as spending.
- **Calendar** — month grid with recurring-event dots, day agenda, and
  add/edit/delete. Events double as tasks: optional priority, due date and
  completion, plus habit-style recurrence (daily, weekly, monthly, alternate
  days, custom weekdays). Each occurrence completes separately and turns
  overdue the day after it is missed.
- **Budget** — hub with balances plus four sub-screens:
  - **Accounts** — multi-month/year filter, per-account credit/spend totals,
    expandable history, account detail with month picker and category filter.
  - **Credit Cards** — limits, utilisation, billing-cycle window (day 29–31
    clamps in short months), purchases/credits, and "pay bill" which writes both
    the card payment and the matching bank expense atomically.
  - **Investments** — portfolio value, P&L, allocation by type, month/all scope.
  - **Metrics** — monthly net worth, bank breakdown by account/category, card
    spending, investment summary.
  - **Activity** — today's activity, plus an all-transactions ledger with
    month/day/year filters and previous/next navigation. Bank and card rows are
    grouped by day, with year view grouped by month.
- **Habits** — Today/All/Archived filters, search, frequency (Daily, Weekly,
  Monthly, Alternate, Custom), optional deadline, check-in, streak/best streak,
  archive/restore, soft delete. Detail shows weekly/monthly calendars and per-day
  status/notes; metrics show monthly completion, a day calendar and per-habit
  grids; the day screen has a journal.
- **Runs** — GPS distance and pace tracking with a live screen, pause/resume,
  km/miles switch, manual distance correction at save, history with per-week/
  month/all-time totals, derived splits and an inline SVG route. Background
  tracking uses the Capacitor background-geolocation plugin; the browser falls
  back to `navigator.geolocation`.
- **Notes** — nested pages with expand/collapse, drag-and-drop reorder/nest
  (cycles rejected), search, pinning, tag filters, tag management, markdown
  preview, inline images, delete-with-descendants.
- **Goals** — active/completed tabs, progress, milestones, edit dialog with slider.
- **Settings** — username, theme mode (system/light/dark), six colour themes,
  distance unit (km/miles), home-section order/toggles, JSON export/import.
- **Onboarding** — restore from a backup or start fresh, then ask for a name.

## Data

Everything is local to the browser profile:

- `clarity` IndexedDB holds habits, notes, note categories,
  note images, transactions, categories, sources, budget limits, goals, events,
  credit cards, credit-card transactions, investments, day journals and runs.
- No rows are seeded. Like the Android app, accounts and categories start empty
  and are created by the user, so a fresh database can never contain duplicate
  defaults.
- **Export data** writes a dated `clarity_export_<date>.json` in the exact shape
  the Android app reads (`ignoreUnknownKeys = true` on both sides). In the
  browser it downloads; in the APK it offers *Save to this device* (system
  *Save to this device* (`Downloads/Clarity/`) or *Share*.
- **Import data** replaces everything in a single Dexie transaction and remaps
  IDs for notes (parent links), card transactions and bill-payment links. A
  failed import leaves the previous data intact.
- **Note images are included** in the backup as base64 data URLs (extra field
  `noteImages`, ignored by the old Android app), so a restore is self-contained.
  Backups made by the old Kotlin app only carry the `![img:uuid]` markers — its
  pictures were files in `clarity/pics` and are not part of that JSON.
- Clearing site data for the origin wipes the database — export first.
- The **port is part of the origin**: `localhost:5173`, `localhost:5174` and
  `http://<your-ip>:5173` each get their own database. If data seems to vanish
  after restarting the dev server, check which port it opened on.

## Automation (mobile)

- **Monthly habit reset** — at 11:30 PM (device local time) on the last day of
  each month every habit is deleted, so a fresh set can be created on the 1st.
  Only the `habits` table is touched — events, notes, money data and journals are
  left alone. If the app was closed at the boundary, the reset is applied on the
  next launch or when the app becomes visible, so it can't be missed.
- **Nightly backup** — on Android a WorkManager job runs at 11:30 PM and copies
  the latest snapshot to `Downloads/Clarity/clarity_backup_<timestamp>.json`,
  deleting the previous backup so only the most recent one remains. The next run
  is pinned to an absolute local 23:30 (`setNextScheduleTimeOverride`) and
  re-pinned after every run, so relaunching the app can't pull it earlier and a
  delayed run doesn't shift the following night. On iOS the snapshot is copied
  to `Files → Clarity` whenever the app is backgrounded or foregrounded, and a
  `BGAppRefreshTask` asks for 23:30 as a best-effort extra (iOS does not allow
  exact wall-clock background jobs). The web layer keeps the snapshot in the app
  cache (on launch, when the app is backgrounded, and every 15 minutes); the
  worker runs without the WebView.

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
│                budget.ts, events.ts, habits.ts, notes.ts (data operations)
├── lib/         dates, formatting, preferences, themes, export/import,
│                run store, geo distance helpers
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
npm run smoke           # renders all 23 routes + dark/empty home, screenshots -> /tmp/opencode/clarity-shots
                        # (clears the dev database when it finishes)
npm run smoke:interact  # add event/transaction, toggle habit, timer, dark mode, onboarding
npm run smoke:logic     # event recurrence, streak, billing clamp, card cascade, note tree, export/import
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
  both stop at the `apk-build` environment). Debug builds share one committed
  key, so a new APK installs over the old one without losing data.
- Local builds need JDK 17+ and the Android SDK: `npm run android:apk`.
- **Run tracking** uses the background-geolocation plugin's foreground service
  (location type) so fixes continue with the screen locked. The manifest asks for
  fine/coarse location plus `FOREGROUND_SERVICE_LOCATION`; it deliberately does
  not request `ACCESS_BACKGROUND_LOCATION`. `useLegacyBridge` is enabled because
  the new Android bridge stops background fixes after ~5 minutes.

Details — signing secrets, app id, versioning and WebView differences — are in
[`android/README.md`](android/README.md).

## iOS IPA

`ios/` is the Capacitor Xcode project (Swift Package Manager, no CocoaPods).
`npm run ios:sync` builds `dist/` and copies it in; app-local Swift plugins
replace the Android-only ones (Files save dialog, backup coordinator).

Like the APK, the IPA is built in GitHub Actions — on `macos-latest`, so no Mac
or Xcode is needed locally. Approve a run in Actions → **iOS IPA** (PRs to
`master` and manual runs stop at the `ios-build` environment), then download it
from the rolling [`ipa-latest` release](https://github.com/deadlyvalentine47/Clarity/releases/tag/ipa-latest):

```
https://github.com/deadlyvalentine47/Clarity/releases/download/ipa-latest/clarity-unsigned.ipa
```

The build is **unsigned** on purpose (no Apple Developer account is assumed).
iOS will not install it by tapping the file — re-sign it with AltStore,
Sideloadly or Xcode using your own Apple ID, or with a developer team profile.

- Local builds need a Mac with Xcode 16+: `npm run ios:sync && npm run ios:open`.
- Backups live in `Files → Clarity` (the app's Documents folder); the 23:30 job
  is best-effort because iOS schedules background work opportunistically.
- Run tracking adds the `location` background mode and the when-in-use / always
  location usage descriptions to `Info.plist`, provided by the same plugin
  through SPM.
- The iOS bundle is `com.clarity.app`, version 1.4 (build 5), matching Android.
