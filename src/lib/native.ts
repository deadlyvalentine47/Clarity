// Thin wrappers around the Capacitor plugins so screens never import native
// modules directly and everything degrades to a no-op in the browser.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'

export const isNative = (): boolean => Capacitor.isNativePlatform()

/** 'android' | 'ios' | 'web' — for the few places the two shells differ. */
export const nativePlatform = (): string => Capacitor.getPlatform()

const TIMER_NOTIFICATION_ID = 1001

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

// ---------------------------------------------------------------- notifications

export async function notificationsGranted(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { display } = await LocalNotifications.checkPermissions()
    return display === 'granted'
  } catch {
    return false
  }
}

export async function requestNotifications(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { display } = await LocalNotifications.requestPermissions()
    return display === 'granted'
  } catch {
    return false
  }
}

const PERMISSIONS_ASKED_KEY = 'clarity.permissionsAsked'

/**
 * Ask for the permission the app can actually use, once per install:
 * notifications (Pomodoro alarms). It is optional — the app works without it,
 * and Settings → Permissions re-opens the prompt.
 */
export async function requestStartupPermissions(): Promise<void> {
  if (!isNative()) return
  if (localStorage.getItem(PERMISSIONS_ASKED_KEY) === '1') return
  localStorage.setItem(PERMISSIONS_ASKED_KEY, '1')

  await requestNotifications()
}

/** Fire a notification when the Pomodoro phase ends, even if the app is backgrounded. */
export async function scheduleTimerNotification(seconds: number, isBreak: boolean): Promise<void> {
  if (!isNative() || seconds <= 0) return
  if (!(await notificationsGranted())) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: TIMER_NOTIFICATION_ID }] })
    await LocalNotifications.schedule({
      notifications: [
        {
          id: TIMER_NOTIFICATION_ID,
          title: isBreak ? 'Break over' : 'Focus session complete',
          body: isBreak ? 'Ready for another focus session?' : 'Nice work — take a break.',
          schedule: { at: new Date(Date.now() + seconds * 1000) },
        },
      ],
    })
  } catch {
    // Notifications are a nicety; the in-app alarm still fires.
  }
}

export async function cancelTimerNotification(): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: TIMER_NOTIFICATION_ID }] })
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
