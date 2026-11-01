# Coding Rules & Conventions

## Database Migrations

- Every schema change (add/rename/remove a column) **must** have a corresponding `Migration` class.
- Bump `version` in `@Database` annotation and add `MIGRATION_{old}_{new}` in the companion object.
- Keep `fallbackToDestructiveMigration()` only as a safety net — do not rely on it.
- Example for adding a nullable column:
  ```kotlin
  val MIGRATION_6_7 = Migration(6, 7) { db ->
      db.execSQL("ALTER TABLE habits ADD COLUMN alternateDays INTEGER DEFAULT NULL")
  }
  ```
- Register in `create()`:
  ```kotlin
  .addMigrations(MIGRATION_6_7)
  .fallbackToDestructiveMigration()
  ```

## UI / Composables

- Use `FilterChip` rows inside `horizontalScroll(rememberScrollState())` when options may overflow the screen width.
- Avoid `ExposedDropdownMenuBox` unless the composable is inside `ExposedDropdownMenuBoxScope`. For standalone clickable dropdowns, use `Box` + `DropdownMenu` + invisible `clickable` overlay.
- Use `Icons.AutoMirrored.Filled.ArrowBack` and `ArrowForward` instead of the deprecated `Icons.Default` variants.
- Time fields: use editable `OutlinedTextField` with validation, not dropdown menus.

## Themes

- Add new themes by defining a `val ThemeName = ThemePalette(...)` in `Color.kt` and adding an entry to the `allThemes` map.
- Each theme needs light and dark variants (18 color fields in `ThemePalette`).
- Theme picker in Settings reads from `allThemes.keys`.

## Habits: Alternate Frequency

- `frequency = "Alternate"` with `alternateDays: Int?` (nullable, only set when frequency is Alternate).
- `alternateDays` = number of days to skip between occurrences. `1` = every other day.
- Expected day formula (from creation date): `daysSinceCreated % (alternateDays + 1) == 0L`.
- `markMissedDays()` and `calculateStreak()` must skip "off" days for alternate habits.

## General

- Debug APK: `./gradlew assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk`
- Release: needs `signingConfigs` in `build.gradle.kts` and a keystore.
- Push a version tag (`v*`) to trigger the GitHub Actions release workflow.
- Do not add comments unless requested.
- Keep responses and code concise.
