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

Actions → **Android APK** → *Run workflow*:

- **debug** (default) — signed with the debug key, installable via sideload.
- **release** — only when the signing secrets below exist, otherwise it warns
  and builds debug instead.

Pushing a `v*` tag also triggers a build. Download the APK from the run's
**Artifacts** section (`clarity-apk`).

Install it with `adb install -r clarity-debug.apk`, or copy it to the phone and
open it (allow "install unknown apps" for the file manager).

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
- **Reminders** are in-app only (Web Audio + vibration). Background
  notifications would need `@capacitor/local-notifications` and a scheduler.
- **Data from the old Kotlin app** cannot be read directly (Room/SQLite vs
  IndexedDB). Export JSON from the old app first, then import it here. Same
  `applicationId` with a different signing key also requires uninstalling the
  old app — so export first.
