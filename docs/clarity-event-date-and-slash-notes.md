# Clarity — Event date moves + slash-command notes (built on one shared TextArea)

## Goal

1. **Move events to another date.** Add a Date field to the Add/Edit Event dialog, with an explicit choice when a recurring series is moved.
2. **Slash commands in free-text fields.** Typing `/` opens a caret-anchored command menu; `- [ ]` / `- ( )` / tables / quotes / code render as real widgets. Clicking a rendered checkbox or radio rewrites the stored text (no new DB columns).
3. **Fix the root cause first.** Today the app has three textarea implementations. Consolidate them into one `TextArea` component, then wire slash commands, live preview, and markdown rendering through it everywhere.

No Dexie schema change is required for anything in this plan: widgets are plain text inside existing `content` / `dailyNotes[key]` / `eventNotes[key]` / `description` columns, so backups keep working.

---

## Part A — Audit: what exists and what is duplicated

### A.1 Feature inventory (for context)

| Area | What it does | Main files |
|---|---|---|
| Home | Greeting hero, agenda (events + overdue), habits chips, budget burn, notes/goals mini-cards | `screens/HomeScreen.tsx` |
| Calendar | Month grid, per-day event list, one-off + recurring events, per-occurrence notes, delete series vs occurrence | `screens/CalendarScreen.tsx`, `db/events.ts` |
| Habits | Groups, streaks, day status (done/late/missed/skipped), per-day notes, day journal, metrics/month grids | `screens/HabitsScreen.tsx`, `HabitDetailScreen.tsx`, `HabitDayScreen.tsx`, `HabitMetricsScreen.tsx`, `db/habits.ts` |
| Notes | Tree/pages, tags, images, markdown preview | `screens/NotesScreen.tsx`, `NoteDetailScreen.tsx`, `db/notes.ts` |
| Goals | Targets, milestones, notes, progress | `screens/GoalsScreen.tsx`, `GoalDetailScreen.tsx`, `db/goals.ts` |
| Budget | Accounts, credit cards, investments, transactions, activity, metrics | `screens/BudgetScreen.tsx`, `screens/budget/*` |
| Runs | Live GPS run, routes, elevation/3D, groups, per-run notes | `screens/RunScreen.tsx`, `RunsScreen.tsx`, `RunDetailScreen.tsx` |
| Settings / Onboarding | Themes, wallpaper, backup export/import, clear data, first launch | `SettingsScreen.tsx`, `OnboardingScreen.tsx`, `lib/exportImport.ts` |

### A.2 Duplication that matters (verified counts)

| Pattern | Count today | Verdict / consolidation |
|---|---|---|
| **Textareas** | **13 call sites, 3 implementations** — `<TextArea>` ×9, `<AutoGrowTextArea>` ×3, raw `<textarea>` ×1; 6 ad-hoc `minHeight` values (70/80/100/160/170/`38vh`) | **This is the root cause.** One `TextArea` with `autoGrow`, size tokens, `ref`, slash commands, preview. |
| Switches | 5 copy-pasted `.switch` buttons, 3 different label treatments | `<Switch>` (later) |
| Checkbox controls | 4 implementations across 9 sites: `Checkbox`, `.event-check` (2 byte-identical copies), `.status-dot` as button, `.habit-chip-check`; only 2 of 9 have `role="checkbox"` | One status/check control (later) |
| Selects | `<Select>` ×6 vs raw `<select>` ×6; Calendar hand-rolls the month/year picker that `MonthYearPicker` already solves | Adopt `MonthYearPicker`/`Select` |
| Field/label | `<Field>` ×54, `<FieldGroup>` ×10, 4 raw `span.label`, labels hard-code `*` | `<FormField>` + required flag (later) |
| Dialog footers | **21 hand-built** "Cancel + primary" rows; 29 `<Dialog>` mounts; 2 mount conventions (`{x && <Dialog open/>}` vs `open={flag}`) plus a `key={editing.id}` workaround | `<DialogFooter>` / `<EntityFormDialog>` |
| Confirm flows | 21 `ConfirmDialog` + 1 hand-rolled copy in `budget/shared.tsx:354`; `ConfirmDialog` always renders `btn-danger`, so "Import" is red | `ConfirmDialog tone`/`busy` |
| Page headers | 24 surfaces, 3 hand-rolled (`GoalsScreen:48`, `CalendarScreen:105`, `NoteDetailScreen:115`) | `PageHeader compact` |
| Collapsibles | 19 surfaces, 15 implementations, 5 identical inline style blobs, 9 identical `new Set(prev)` toggles, 6 chevron styles | `<Collapsible>` + `useExpandedSet` |
| Clickable cards | 9 `role="button" tabIndex=0` + duplicate key handlers; 4 double-fire on Space (`BudgetScreen:147`, `HomeScreen:761`, `CreditCardsScreen:62`, `GoalsScreen:94`) | `activationProps()` / real `<button>` |
| Toasts | Host exists in `App.tsx` but is unreachable; 3 local "Saved" flashes duplicate it and leak timers | `ToastProvider` + `useSavedFlash` |
| Rows/cards | 25 near-duplicate row implementations (15 are the same skeleton) | `<RowCard>` |
| Status presentation | 7 divergent habit-status tables, 2 event tables, 2 goal tables, 33 hand-rolled chip blocks, 15 icon-button size overrides | `STATUS_META` + `StatusBadge` + `ChipGroup` |
| Inline styles | **474** `style={{}}` objects (26 redundant `minWidth:0`, 68 `marginBottom`, 22 `justifyContent:'flex-end'`) | utility classes, done after components absorb them |
| Data layer | 66 `useLiveQuery`, 54 whole-table `toArray()`, 16 read-modify-write bodies, 10 near-identical per-day map updaters, 18 hand-written import normalizers, recurrence + month-grid + month-step logic duplicated 2–5× | `hooks/queries.ts`, `db/mutations.ts`, `db/normalize.ts`, `lib/recurrence.ts`, `lib/dateUi.ts` (later) |

**Latent bugs surfaced by the audit** (safe to fix when touched): Space double-fire on 4 cards; double-submit in Clear-data; `CreditCardDetailScreen` null-before-undefined flash; 3 toast timer leaks; `RunDetailScreen` renders blank while loading; `CalendarScreen EventDialog` re-anchors a recurring series to the *selected* day on every save (Part C fixes this).

### A.3 Recommended consolidation order (deferred backlog, not this change)

| Priority | Work | Sites | Payoff |
|---|---|---|---|
| **Now** | Unified `TextArea` + markdown engine + slash menu | 13 + 3 | Prerequisite for the feature |
| P0-next | `DialogFooter`/`EntityFormDialog`, `PageHeader compact`, `useOverlay` (drawer fork), `ToastProvider`/`useSavedFlash`, `activationProps`, `ConfirmDialog tone/busy` | ~60 | ~600 LOC, 5 bug fixes |
| P1 | `<Collapsible>` + `useExpandedSet`, `STATUS_META`/`StatusBadge`/`StatusDot`, `<RowCard>`, `<ChipGroup>`, `<SearchInput>`, `MonthYearPicker` adoption, `IconButton size`, `EmptyState` variants/`LoadingState`, `<FormError>`, `<HiddenFileInput>` | ~120 | Biggest remaining duplication |
| P2 | `<PeriodNav>` + `useRangeMode` (Runs/AllTransactions ~90-line twins), query hooks, `db/mutations` map updaters, `db/normalize` normalizers, `lib/recurrence`, `lib/dateUi`, error surfacing + transactions | ~60 | Correctness + maintainability |

This plan implements **only the "Now" row** plus the two requested features and two small landings that directly touch the same files (`useSavedFlash`, `noteSnippet`).

---

## Part B — One shared TextArea + markdown engine

### B.1 New `src/components/TextArea.tsx`

Single component that absorbs all three current variants.

```ts
export type TextAreaSize = 'sm' | 'md' | 'lg'   // 80 / 120 / 160 min-height

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string
  onValueChange: (next: string) => void
  size?: TextAreaSize                 // default 'md'
  autoGrow?: boolean                  // default true; clamp with maxHeight
  maxHeight?: string                  // default '55vh'
  preview?: 'none' | 'below'          // default 'none'
  interactivePreview?: boolean        // default true when preview is on
  commands?: readonly SlashCommand[] | false  // default TEXT_COMMANDS
  onCommand?: (id: string) => void    // for /image (Notes only)
  ref?: Ref<HTMLTextAreaElement>      // React 19 ref-as-prop
}
```

Behavior:
- Wrapper `<div className="ta">` with `position: relative` so the slash menu can anchor inside it (no portal needed, avoids dialog clipping).
- Always controlled. Auto-grow sets `height = max(sizeMinHeight, scrollHeight)` up to `maxHeight`, then scrolls; re-measures on value and `window.resize`.
- On `preview === 'below'` and non-empty value, renders `<MarkdownPreview content={value} onChange={interactivePreview ? onValueChange : undefined} />` inside `.ta-preview`.
- Keeps the existing controlled-keyboard behavior; no `defaultValue`.
- Exposes `ref` so `NoteDetailScreen`'s image insertion (`areaRef` + `setSelectionRange`) keeps working and the raw `<textarea>` escape hatch (`NoteDetailScreen.tsx:180`) disappears.
- `ui.tsx` re-exports `TextArea` from the new file and keeps `AutoGrowTextArea` as a one-line alias (`<TextArea autoGrow ... />`) until every call site migrates; new code imports directly.

### B.2 Migration of all 13 textareas

| File:line | Current | After |
|---|---|---|
| `NotesScreen.tsx:630` | `TextArea` (new note) | `TextArea` + `commands={NOTE_COMMANDS}` + `onCommand` (image) |
| `NoteDetailScreen.tsx:180` | raw `<textarea ref>` | `TextArea ref={areaRef} size="lg" commands={NOTE_COMMANDS}` |
| `HabitDayScreen.tsx:302` | `AutoGrowTextArea` | `TextArea id=… value={note} onValueChange={setNote} preview="below"` |
| `HabitDayScreen.tsx:159` | `AutoGrowTextArea` (journal) | `TextArea preview="below" autoGrow` |
| `HabitDetailScreen.tsx:375` | `TextArea` (day note dialog) | `TextArea preview="below"` |
| `CalendarScreen.tsx:333` | `AutoGrowTextArea` (event note) | `TextArea preview="below"` |
| `CalendarScreen.tsx:482` | `TextArea` (event description) | `TextArea autoGrow={false} size="sm"` |
| `HabitsScreen.tsx:753` | `TextArea` (habit description) | `TextArea autoGrow={false} size="sm"` |
| `GoalsScreen.tsx:234` | `TextArea` (goal description) | `TextArea autoGrow={false} size="sm"` |
| `GoalDetailScreen.tsx:209` | `TextArea` (milestone note, blur-save) | `TextArea autoGrow={false} size="sm"` |
| `RunScreen.tsx:423` / `RunDetailScreen.tsx:243` | `TextArea` (run notes) | `TextArea autoGrow={false} size="sm"` |
| `InvestmentsScreen.tsx:295` | `TextArea` (investment notes) | `TextArea autoGrow={false} size="sm"` |

All call sites change `onChange={(e) => setX(e.target.value)}` → `onValueChange={setX}`. This is mechanical and is the point of the refactor.

### B.3 `src/lib/markdown.ts` — block parser

Replace the inline `if (line.startsWith(...))` chain in `MarkdownPreview.tsx` with a parser that keeps line indices (needed for click-to-toggle).

Block kinds and syntax:
- `# ` / `## ` / `### ` headings (existing).
- `- ` / `* ` bullets (existing), `1. ` ordered (existing, keep number visible).
- `- [ ] ` / `- [x] ` **task** (checkbox).
- `- ( ) ` / `- (x) ` **radio** — contiguous radio lines form one single-select group; choosing one clears the others in that block.
- **GFM pipe table** — a line with `|` followed by a separator row `| --- | --- |`; consumes contiguous pipe rows. Render inside `.md-table-wrap` (horizontal scroll on mobile).
- `> ` quote.
- ```` ``` ```` fenced code.
- `---` / `***` horizontal rule.
- `![img:uuid]` (existing).
- Blank → spacer.
- Inline: `**bold**`, `*italic*` (existing) plus `` `code` `` and `[label](url)`.

Exports:
```ts
parseMarkdown(content): MdBlock[]                 // blocks carry startLine/endLine
renderInline(text): ReactNode[]
toggleTaskLine(content, lineIndex): string        // [ ] <-> [x]
selectRadioLine(content, lineIndex): string       // one (x), siblings ( )
stripMarkdownForSnippet(content): string
```

Rewrite `src/components/MarkdownPreview.tsx` on top of it. New props:
```tsx
{ content: string; onChange?: (next: string) => void }
```
`onChange` makes task/radio widgets interactive (`<button role="checkbox" aria-checked>` / `role="radio"` in `role="radiogroup"`), rewriting the source text. Without `onChange` they render static and disabled.

Update `noteSnippet` (`db/notes.ts:251`) to strip task/radio markers, table pipes/separators, fences, `---`, and keep image markers as `[image]`.

### B.4 Slash commands

**`src/lib/slashCommands.ts`**

```ts
export interface SlashCommand {
  id: string                     // "todo"
  label: string                  // "To-do list"
  hint: string                   // "Checklist with tickable boxes"
  keywords?: string[]
  insert: string                 // text that replaces "/query"
  caretOffset?: number           // from end of inserted text (default 0)
  action?: () => void            // e.g. image picker; skips text insertion
}
export const TEXT_COMMANDS: readonly SlashCommand[]   // default everywhere
export const NOTE_COMMANDS: readonly SlashCommand[]   // TEXT_COMMANDS + /image
```

Command set:

| Command | Inserts | Notes |
|---|---|---|
| `/todo` | `- [ ] ` | renders as a checkbox; Enter on a task line continues the list |
| `/radio` | `- ( ) ` | contiguous lines form a single-select group |
| `/table` | `\| Column 1 \| Column 2 \|` + separator + empty row | caret lands in first cell |
| `/heading` | `## ` | |
| `/subheading` | `### ` | |
| `/bullet` | `- ` | |
| `/numbered` | `1. ` | |
| `/quote` | `> ` | |
| `/code` | fenced block, caret inside | |
| `/divider` | `---` on its own line | |
| `/today` | `YYYY-MM-DD` | uses `toDateKey(new Date())` |
| `/image` | — | Notes only; calls `onCommand('image')` → existing `onPickImage` |

**`src/lib/caretRect.ts`** — `caretRect(textarea): { left, top, height }` using the standard hidden mirror div (copies font/padding/border/white-space/wrap), subtracts `scrollTop`/`scrollLeft`. Fallback to `{ left: 0, top: 0 }` if measurement fails.

**`src/components/SlashMenu.tsx`** — presentational listbox:
`role="listbox"`, items `role="option"` + `aria-selected`; props `items`, `activeIndex`, `onPick`, `onHover`, `style` (absolute coordinates). `onPointerDown` calls `preventDefault()` so the textarea keeps focus and mobile keyboards don't dismiss.

**Wiring inside `TextArea`**
- Trigger: on change/select, inspect text before the caret; current line must match `/^([ \t]*)\/([a-z0-9]*)$/i`. Show the menu, filter by `id`/`label`/`keywords`.
- Keys while open: `ArrowDown`/`ArrowUp` move, `Enter`/`Tab` apply, `Escape` closes, `Space` applies when the query exactly equals a command id. All call `preventDefault()`; `Escape` also calls `stopPropagation()` so the surrounding `Dialog` does **not** close.
- Apply: replace from the line's indentation through the caret with the command's insert text; place the caret using `caretOffset`; reset the query and close.
- Multi-line blocks (`/table`, `/code`) ensure a leading/trailing newline so they never fuse with neighbouring text.
- `Enter` on a task line (`- [ ] `) inserts `\n${indent}- [ ] `; Enter on an empty task removes the marker.
- Accessibility: `aria-expanded`, `aria-controls` on the textarea; menu has `aria-label="Insert block"`.
- `Escape` conflict guard: verify dialog stays open; if React's synthetic `stopPropagation` is not enough, call `e.nativeEvent.stopImmediatePropagation()`.

### B.5 Where widgets render

| Surface | Rendering | Interactivity |
|---|---|---|
| Notes detail (view + live preview) | `MarkdownPreview` | clicks rewrite text, persisted immediately |
| New-note dialog preview | `MarkdownPreview` | interactive inside the dialog |
| Habit day note (`HabitDayScreen`, `HabitDayDialog`) | `preview="below"` | toggle updates local `note`, persisted by existing Save |
| Event note (`EventItem`) | `preview="below"` | same; tapping must `stopPropagation` so the card doesn't collapse |
| Journal | `preview="below"` | same, existing Save |
| Event description (card), goal description (list + detail), habit description (list + detail), run notes (detail), investment notes (display), milestone note (display) | swap the raw `{text}` render for `MarkdownPreview` (static) | no |

### B.6 Styles (`src/styles.css`, append)

`.ta` (relative wrapper), `.ta-preview` (surface-2 card, top margin), `.slash-menu` (absolute, `z-index: 70`, max-height 260px, overflow auto, scrim shadow), `.slash-menu-item`, `.slash-menu-item[aria-selected='true']`, `.md-task`, `.md-check`, `.md-radio`, `.md-radio-group`, `.md-quote`, `.md-code`, `.md-hr`, `.md-table-wrap`, `.md-table`, `.md-link`. Use existing CSS variables only; keep 44px touch targets on coarse pointers (`.slash-menu-item { min-height: 40px }` + coarse override).

### B.7 `useSavedFlash` (small related landing)

`src/hooks/useSavedFlash.ts`: `useSavedFlash(ms = 1800): [boolean, () => void]` with `clearTimeout` on unmount. Replace the three copies at `CalendarScreen.tsx:230/240`, `HabitDayScreen.tsx:52/135`, `HabitDayScreen.tsx:225/263`. This is the only P0 item folded in because those exact functions are being edited for the note preview.

---

## Part C — Event date moves

### C.1 Dialog changes (`src/screens/CalendarScreen.tsx`, `EventDialog`)

- New state: `const [dateKey, setDateKey] = useState(() => toDateKey(event?.startDate ?? date))`.
  Seeding from `event.startDate` (not the `date` prop) also fixes the existing bug where opening any occurrence and saving re-anchored a recurring series to the selected day.
- New `<Field label="Date">` with `<TextInput type="date" value={dateKey} onChange=…>` placed above Start/End time. Remove the read-only date line at `:565-567` (or derive it from `dateKey`).
- `save()` uses `fromDateKey(dateKey)` as the day for `combineDateTime` instead of the `date` prop.
- `key = freq ? dateKey : toDateKey(start)`.
- One-off move: `dueDate` shifts by the same day delta when it was not manually edited (compare against the initial due key); migrate `completionHistory` from the old key to the new one.
- Add `timeValue` / `combineDateTime` to `src/lib/dates.ts` (currently private in `CalendarScreen.tsx:377-385`) so the dialog and `events.ts` share one implementation.

### C.2 Recurring series — "ask per save"

If `editing && event.frequency && dateKey !== toDateKey(event.startDate)`, `save()` does **not** write yet. It stores the computed fields in `pendingMove` and renders an inline choice panel in the dialog:

> This event repeats. Move the whole series, or only this occurrence?
> `[Move whole series]` `[Move this occurrence only]` `[Cancel]`

- **Move whole series**
  `db.events.put({ ...event, ...fields })`, plus:
  ```ts
  const delta = daysBetween(fromDateKey(toDateKey(event.startDate)), fromDateKey(dateKey))
  const shifted = shiftEventDateMaps(event, delta) // completionHistory, skippedDates, eventNotes
  ```
  Re-apply the `completed` switch at the new occurrence key. Add `shiftEventDateMaps(event, delta)` to `src/db/events.ts` — pure, testable; shifting keys keeps notes/completions/skips aligned with the occurrences.
- **Move this occurrence only**
  1. Mark the occurrence being viewed as skipped: `skippedDates[eventCompletionKey(event, date)] = true`; delete its completion entry (and carry `done` to the new row).
  2. `db.events.add({ ...fields, frequency: null, alternateDays: null, selectedDays: null, dueDate: shifted or null, completionHistory: completed ? { [toDateKey(start)]: true } : {}, skippedDates: {}, eventNotes: {}, category/color carried, createdAt: Date.now() })`.
  The series keeps its original anchor; the moved day becomes a standalone one-off.
- **Cancel** returns to the form with the state intact.
- Non-recurring moves never show the chooser.

### C.3 Display

No changes needed: Calendar/Home use `useLiveQuery` and derive occurrence dates from `startDate`, so lists, month dots, overdue badges and `eventFrequencyLabel` update automatically. `dueDate` shifts with the event for one-offs.

---

## Part D — File-by-file change list

### New files
| File | Purpose |
|---|---|
| `src/components/TextArea.tsx` | Unified textarea (auto-grow, sizes, ref, slash, preview) |
| `src/components/SlashMenu.tsx` | Caret-anchored command listbox |
| `src/lib/slashCommands.ts` | Command types, `TEXT_COMMANDS`, `NOTE_COMMANDS`, insertion logic |
| `src/lib/markdown.ts` | Block parser, inline renderer, task/radio rewrite, snippet stripping |
| `src/lib/caretRect.ts` | Mirror-div caret coordinates |
| `src/hooks/useSavedFlash.ts` | Cleaned-up "Saved" flash |

### Modified files
| File | Change |
|---|---|
| `src/components/ui.tsx` | Re-export `TextArea`/`AutoGrowTextArea` from new component; drop the old implementations |
| `src/components/MarkdownPreview.tsx` | Rebuild on `lib/markdown`; add `onChange`, task/radio/table/quote/code/hr/link rendering |
| `src/styles.css` | Slash menu, editor preview, markdown widget styles |
| `src/db/notes.ts` | `noteSnippet` strips new markers; keep `insertImageMarker` |
| `src/db/events.ts` | `shiftEventDateMaps` (and export any date helpers used by the dialog) |
| `src/lib/dates.ts` | Add `timeValue`, `combineDateTime` |
| `src/screens/CalendarScreen.tsx` | Event date field, move chooser, event note → unified TextArea + preview, event description rendering, `useSavedFlash` |
| `src/screens/NoteDetailScreen.tsx` | Raw textarea → `TextArea` with `ref`, `NOTE_COMMANDS`, live preview uses interactive `MarkdownPreview` |
| `src/screens/NotesScreen.tsx` | New-note `TextArea` with commands + image; preview via shared renderer |
| `src/screens/HabitDayScreen.tsx` | Habit note + journal → `TextArea` + preview; `useSavedFlash` |
| `src/screens/HabitDetailScreen.tsx` | Day-note dialog `TextArea` + preview |
| `src/screens/HabitsScreen.tsx` | Habit description textarea; render markdown in card |
| `src/screens/GoalsScreen.tsx` / `GoalDetailScreen.tsx` | Goal description / milestone note → `TextArea`; render markdown |
| `src/screens/RunScreen.tsx` / `RunDetailScreen.tsx` | Run notes → `TextArea`; render markdown in detail |
| `src/screens/budget/InvestmentsScreen.tsx` | Investment notes → `TextArea`; render markdown |

No changes to `db/db.ts`, `db/types.ts`, or `lib/exportImport.ts` — nothing new is persisted.

---

## Part E — Verification

### Automated
- `npm run typecheck` — the main safety net (no unit-test framework in the repo).
- `npm run build` — catches CSS/import issues.
- Optional, if a Chrome path is configured: `npm run smoke`, `npm run smoke:interact`, `npm run smoke:flows`.

### Manual QA matrix
**Event date**
1. Edit a one-off event → change Date → Save: it moves to the day, keeps start/end times, appears in the new day's list and month dot, disappears from the old day.
2. One-off with a due date: move the date without touching Due date → due date shifts by the same number of days. Manually edit Due date → it keeps the manual value.
3. Recurring (Daily / Weekly / Alternate / Custom): change the date → chooser appears.
   - *Move whole series*: anchor changes, occurrences follow the new parity, per-occurrence notes/completions remain attached to their occurrences.
   - *Move this occurrence only*: the original series keeps its anchor and the old day's occurrence disappears; a one-off appears on the new day.
   - *Cancel*: dialog stays open, nothing written.
4. Open a recurring event on a non-anchor occurrence and Save without changing the date → series anchor is **unchanged** (regression for the old re-anchor bug).
5. Add-event dialog defaults the Date to the selected day; Home's add-event defaults to today.

**Slash commands / widgets**
6. Type `/` on an empty line → menu opens at the caret; `ArrowDown/Up` move; `Enter`/`Tab` insert; `Esc` closes the menu **and leaves the dialog open**.
7. Type `/todo` and a space → expands to `- [ ] `; Enter continues the list.
8. `/table`, `/radio`, `/quote`, `/code`, `/divider`, `/heading` insert the right blocks; a table renders inside a horizontal scroller on a narrow viewport.
9. In Notes: tick a checkbox → the stored text changes `[ ]`→`[x]` and survives reload; choosing a radio clears its siblings; static view also toggles.
10. Habit note, event note, journal: preview appears below the field while typing; ticking a box updates the textarea; Save persists; event-card preview tap does not collapse the card.
11. Notes image insert still lands at the caret after the textarea migration.
12. Add a note with widgets → Notes list snippet shows readable text (no `- [ ]` / `|` artifacts).
13. Export → clear data → import: widgets and notes survive unchanged.

**Accessibility / mobile**
14. Keyboard-only: reach the menu, filter, insert, dismiss; checkbox/radio are announced with correct roles/state.
15. On a coarse pointer the menu items are ≥40px; tapping the menu does not dismiss the on-screen keyboard.

---

## Part F — Risks & mitigations

| Risk | Mitigation |
|---|---|
| `Escape` inside the slash menu closes the surrounding `Dialog` (document-level listener, `ui.tsx:210`) | `preventDefault()` + `stopPropagation()`; fall back to `nativeEvent.stopImmediatePropagation()`. Verify manually in every dialog. |
| Caret mirror measurement drifts (fonts, padding, wrapping) | Copy computed styles explicitly; clamp menu into the wrapper; fall back to the field's top-left. |
| Auto-grow + preview causes dialog jumpiness | `autoGrow={false}` + `size="sm"` for dialog descriptions; preview only on note surfaces. |
| Interactive preview rewrites text while typing | Rewrites happen only on widget click, operating on the current `value`; textarea stays controlled. |
| Recurring map shifting collides keys | `shiftDateKeyMap` shifts in one pass; on collision the shifted value wins; keys are derived from `startDate` so a move always changes them. |
| "Move this occurrence only" duplicates a completed item | Carries `completed` onto the new one-off and deletes the old completion entry before skipping. |
| Two write paths (Calendar vs Home add) diverge | Both use the same `EventDialog`; Home remains add-only and now gets the Date field for free. |

---

## Part G — Explicitly out of scope (backlog from audit)

`DialogFooter`/`EntityFormDialog`, `PageHeader compact`, `useOverlay` drawer unification, `ToastProvider`, `activationProps`/real `<button>` cards, `ConfirmDialog tone/busy`, `<Collapsible>` + `useExpandedSet`, `STATUS_META`/`StatusBadge`/`StatusDot`, `<RowCard>`, `<ChipGroup>`, `<SearchInput>`, `MonthYearPicker` adoption in Calendar, `IconButton size`, `EmptyState`/`LoadingState` variants, `<FormError>`, `<HiddenFileInput>`, `<PeriodNav>` + `useRangeMode`, query hooks, `db/mutations`, `db/normalize`, `lib/recurrence`, `lib/dateUi`, error surfacing and transaction fixes. These are sequenced in Part A.3 and should land as follow-up changes so this one stays reviewable.
