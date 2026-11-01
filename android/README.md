# Android app (Capacitor)

The Android APK is the same React app running inside a WebView. `android/` is a
standard Capacitor project — nothing here is hand-written except the manifest
permissions, and everything is generated from `dist/` by `cap sync`.

## How the build works

```
npm run build          # Vite -> dist/
npx cap sync android   # dist/ -> android/app/src/main/assets/public + plugin config
./gradlew assembleDebug
```

`android:sync` and `android:apk` in `package.json` wrap the first two steps and
the Gradle build.

The APK is built **in CI** (`.github/workflows/android.yml`) because that runner
already has the Android SDK and JDK. Locally you only need Node:

```bash
npm run android:sync        # safe without a JDK — just copies the web assets
```

To build locally you additionally need JDK 17+ and the Android SDK
(`ANDROID_HOME`), then:

```bash
npm run android:apk         # -> android/app/build/outputs/apk/debug/app-debug.apk
```

## Getting an APK from CI

Actions → **Android APK** → *Run workflow* (or open a PR against `master`).
Every run pauses at the `apk-build` environment until a reviewer approves it, so
commits pushed before you are done cost nothing. Approving builds the latest
commit.

- **debug** (default) — signed with the debug key, installable via sideload.
- **release** — only when the signing secrets below exist, otherwise it warns
  and builds debug instead.

The finished APK is attached to the rolling **apk-latest** release, where it
downloads as a plain file:

```
https://github.com/deadlyvalentine47/Clarity/releases/download/apk-latest/clarity-debug.apk
```

(The run's *Artifacts* section also has it, but GitHub always wraps artifacts in
a zip.)

Install it with `adb install -r clarity-debug.apk`, or copy it to the phone and
open it (allow "install unknown apps" for the file manager).

## Debug signing key

`android/app/clarity-debug.p12` is committed on purpose. A runner without it
generates a fresh debug keystore for every build, which means each new APK has a
different signature and refuses to install over the previous one
(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`) — and uninstalling wipes the WebView's
IndexedDB. With a pinned key, CI builds upgrade in place:

```bash
adb install -r clarity-debug.apk
```

It is a debug key (alias `claritydebugkey`, password `android`), public by
convention. Never sign a Play Store release with it — see below.

## Signing (optional, for release builds)

Generate a keystore once:

```bash
keytool -genkeypair -v -keystore clarity-release.keystore \
  -alias clarity -keyalg RSA -keysize 2048 -validity 10000
```

Add these repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 clarity-release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `clarity` |
| `ANDROID_KEY_PASSWORD` | key password |

Never commit the keystore. The workflow writes it to `android/app/` at build
time and it is git-ignored.

## App identity

| Setting | Value |
| --- | --- |
| Application id | `com.clarity.app` |
| Min SDK | 24 (Android 7) |
| Target SDK | 36 |
| Version | `android/app/build.gradle` → `versionCode` / `versionName` |

Bump `versionCode` for every APK you install over an older one.

## Permissions

Requested at first launch (Settings → Permissions shows the notification state):

| Permission | Why | If refused |
| --- | --- | --- |
| `POST_NOTIFICATIONS` | Pomodoro phase alarms while the app is in the background | the in-app alarm still plays |
| `READ_MEDIA_IMAGES` (13+) / `READ_EXTERNAL_STORAGE` (≤12) | read the old app's note pictures from `clarity/pics` | pick the files once via *Settings → Data → Repair note images* |
| `VIBRATE` | alarm vibration | silent alarm |
| `SCHEDULE_EXACT_ALARM` | exact alarm delivery | Android may delay the notification |

`MediaPermissionPlugin.java` is the only hand-written Java: the Filesystem
plugin only knows the pre-Android-13 storage permission, so it asks for
`READ_MEDIA_IMAGES` itself.

## Note images after an import

Backups made by **this** app embed the pictures as base64 data URLs, so a
restore brings them back with no extra step. Backups made by the **old Kotlin
app** contain only `![img:uuid]` markers — it kept the JPEGs as files in
`/storage/emulated/0/clarity/pics/<uuid>.jpg`. After importing one, *Settings →
Data → Repair note images* re-links them: it first tries that folder, and if the
OS refuses access it opens the file picker (pick the files inside
`clarity/pics`; they are matched by name).

Pictures added in the app are downscaled to 1280 px JPEG and stored as blobs in
IndexedDB — no storage permission is involved, because the system picker hands
the WebView a readable copy.

## Clearing data

*Settings → Data → Clear data* empties every table but keeps the preferences
(name, theme, home layout) in `localStorage`.

## Things that behave differently in the WebView

- **Storage** is per-app (WebView IndexedDB), not shared with the browser. The
  in-app *Settings → Data → Export* is the backup; uninstalling wipes the data.
- **Export** writes the JSON to the app cache and opens the system share sheet
  (Files, Drive, email…), because `<a download>` does nothing in a WebView.
- **Import** uses the normal file picker and works unchanged.
- **Routing** switches to `HashRouter` on native (`src/main.tsx`), since there is
  no server to fall back to `index.html` on deep links.
- **Status/navigation bars** are handled with `env(safe-area-inset-*)` in
  `src/styles.css` (Android 15+ draws edge-to-edge).
- **Reminders** are in-app only. The Pomodoro alarm also posts a local
  notification so it fires while the app is backgrounded.
- **Back button** steps back through the screens and only leaves the app from
  Home, after a second press ("Press back again to exit").
- **Data from the old Kotlin app** cannot be read directly (Room/SQLite vs
  IndexedDB). Export JSON from the old app first, then import it here. Same
  `applicationId` with a different signing key also requires uninstalling the
  old app — so export first.
