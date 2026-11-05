// Thin wrappers around the Capacitor plugins so screens never import native
// modules directly and everything degrades to a no-op in the browser.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'

export const isNative = (): boolean => Capacitor.isNativePlatform()

/** 'android' | 'ios' | 'web' — for the few places the two shells differ. */
export const nativePlatform = (): string => Capacitor.getPlatform()

// Local plugins:
//   Android android/app/src/main/java/com/clarity/app/SaveFilePlugin.java
//   iOS     ios/App/App/SaveFilePlugin.swift
// The system "Save as" dialog (Android SAF, iOS Files) for the exported JSON.
interface SaveFilePlugin {
  save(options: {
    filename: string
    /** Path of the file to copy — the contents never cross the bridge. */
    sourcePath: string
    mimeType?: string
  }): Promise<{ uri?: string; bytes?: number; location?: string; cancelled?: boolean }>
}
const SaveFile = registerPlugin<SaveFilePlugin>('SaveFile')

/**
 * Open the system "Save as" picker and copy `sourcePath` into the chosen file.
 * Returns the number of bytes written, or null when the user backs out.
 * No storage permission is involved: Android's picker grants access to that
 * one file and iOS writes a copy into Files.
 */
export async function saveFileToDevice(
  filename: string,
  sourcePath: string,
  mimeType = 'application/json',
): Promise<{ bytes: number; location: string } | null> {
  const result = await SaveFile.save({ filename, sourcePath, mimeType })
  if (result.cancelled) return null
  return { bytes: result.bytes ?? 0, location: result.location ?? '' }
}

// ---------------------------------------------------------------- location

export interface LocationFix {
  lat: number
  lng: number
  /** horizontal accuracy in metres */
  accuracy: number
  altitude: number | null
  speed: number | null
  /** epoch ms */
  timestamp: number
}

export interface LocationError {
  /** plugin/browser code, e.g. NOT_AUTHORIZED or UNAVAILABLE */
  code: string
  message?: string
}

// BackgroundGeolocation keeps delivering fixes through a foreground service
// (Android) / location updates (iOS) while the screen is locked. Importing the
// package directly is pointless here — registerPlugin avoids loading its web
// shim and keeps the browser fallback dependency-free.
interface BackgroundLocation {
  latitude: number
  longitude: number
  accuracy: number
  altitude: number | null
  speed: number | null
  time: number | null
}

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: {
      backgroundMessage?: string
      backgroundTitle?: string
      requestPermissions?: boolean
      stale?: boolean
      distanceFilter?: number
    },
    callback: (
      position?: BackgroundLocation,
      error?: { code?: string; message?: string },
    ) => void,
  ): Promise<string>
  removeWatcher(options: { id: string }): Promise<void>
  openSettings(): Promise<void>
}

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')

/**
 * Start watching the device location. Returns an idempotent stop function.
 * Native: background-capable plugin watcher. Web: best-effort
 * `navigator.geolocation` — permission failures are reported through
 * `onError`, never as console errors.
 */
export async function startLocationWatcher(
  onFix: (fix: LocationFix) => void,
  onError: (error: LocationError) => void,
): Promise<() => void> {
  if (!isNative()) {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onError({ code: 'UNAVAILABLE', message: 'Location is not available' })
      return () => {}
    }
    const id = navigator.geolocation.watchPosition(
      (position) =>
        onFix({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          speed: position.coords.speed,
          timestamp: position.timestamp || Date.now(),
        }),
      (error) =>
        onError({
          code:
            error.code === error.PERMISSION_DENIED
              ? 'NOT_AUTHORIZED'
              : error.code === error.POSITION_UNAVAILABLE
                ? 'UNAVAILABLE'
                : 'TIMEOUT',
          message: error.message,
        }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }

  const id = await BackgroundGeolocation.addWatcher(
    {
      backgroundMessage: 'Tracking your run',
      backgroundTitle: 'Clarity run',
      requestPermissions: true,
      stale: false,
      distanceFilter: 5,
    },
    (position, error) => {
      if (error) {
        onError({ code: error.code ?? 'UNAVAILABLE', message: error.message })
        return
      }
      if (!position) return
      onFix({
        lat: position.latitude,
        lng: position.longitude,
        accuracy: position.accuracy,
        altitude: position.altitude,
        speed: position.speed,
        timestamp: position.time ?? Date.now(),
      })
    },
  )

  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    void BackgroundGeolocation.removeWatcher({ id }).catch(() => {
      // The watcher may already be gone after a process restart.
    })
  }
}

/** Open this app's system settings so a denied location permission can be fixed. */
export async function openLocationSettings(): Promise<void> {
  if (!isNative()) return
  try {
    await BackgroundGeolocation.openSettings()
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------- barometer

export interface BarometerReading {
  /** epoch ms */
  t: number
  /** metres relative to when tracking started */
  relativeAltitude: number
}

// Local plugins:
//   Android android/app/src/main/java/com/clarity/app/BarometerPlugin.java
//   iOS     ios/App/App/BarometerPlugin.swift
// Readings are buffered natively and polled: pushing them over the bridge
// while the WebView is suspended would lose most of a run.
interface BarometerApi {
  isAvailable(): Promise<{ available: boolean }>
  start(): Promise<void>
  drain(): Promise<{ readings: BarometerReading[] }>
  stop(): Promise<void>
}

const Barometer = registerPlugin<BarometerApi>('Barometer')

/** Barometric sensors are absent on some phones; callers fall back to GNSS. */
export async function barometerAvailable(): Promise<boolean> {
  if (!isNative()) return false
  try {
    return (await Barometer.isAvailable()).available
  } catch {
    return false
  }
}

/** Start sampling and reset the relative-altitude baseline. */
export async function startBarometer(): Promise<boolean> {
  if (!isNative()) return false
  try {
    if (!(await Barometer.isAvailable()).available) return false
    await Barometer.start()
    return true
  } catch {
    return false
  }
}

export async function drainBarometer(): Promise<BarometerReading[]> {
  if (!isNative()) return []
  try {
    const { readings } = await Barometer.drain()
    return Array.isArray(readings) ? readings : []
  } catch {
    return []
  }
}

export async function stopBarometer(): Promise<void> {
  if (!isNative()) return
  try {
    await Barometer.stop()
  } catch {
    // ignore
  }
}


// ---------------------------------------------------------------- back button

/**
 * Android back: step back through the router, and only leave the app from the
 * home screen. Without this the WebView closes the app on the first press.
 */
export function registerBackButton(onExit: () => void): () => void {
  if (!isNative()) return () => {}
  let remove: (() => void) | undefined
  void CapacitorApp.addListener('backButton', () => {
    const hash = window.location.hash
    const atHome = hash === '' || hash === '#/' || hash === '#'
    if (atHome) {
      onExit()
      return
    }
    window.history.back()
    // Nothing to go back to (deep link or first screen): fall back to home.
    window.setTimeout(() => {
      if (window.location.hash === hash) window.location.hash = '#/'
    }, 200)
  }).then((handle) => {
    remove = () => void handle.remove()
  })
  return () => remove?.()
}

export async function exitApp(): Promise<void> {
  if (!isNative()) return
  try {
    await CapacitorApp.exitApp()
  } catch {
    // ignore
  }
}
