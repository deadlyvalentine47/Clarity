// Thin wrappers around the Capacitor plugins so screens never import native
// modules directly and everything degrades to a no-op in the browser.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { Filesystem } from '@capacitor/filesystem'
import { LocalNotifications } from '@capacitor/local-notifications'

export const isNative = (): boolean => Capacitor.isNativePlatform()

const TIMER_NOTIFICATION_ID = 1001

// Local plugin (android/app/src/main/java/com/clarity/app/MediaPermissionPlugin.java).
interface MediaPermissionPlugin {
  request(): Promise<{ granted: boolean }>
}
const MediaPermission = registerPlugin<MediaPermissionPlugin>('MediaPermission')

/**
 * Read access to images in shared storage — required on Android 13+ to read
 * the old app's `clarity/pics` files by path. Returns false when refused.
 */
export async function requestImageReadAccess(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { granted } = await MediaPermission.request()
    return granted
  } catch {
    return false
  }
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

/**
 * Ask for the permissions the app can actually use, once, at startup:
 * notifications (Pomodoro alarms) and read access to shared storage (re-linking
 * the old app's note images). Both are optional — the app works without them.
 */
export async function requestStartupPermissions(): Promise<void> {
  if (!isNative()) return
  await requestNotifications()

  // Read access to shared storage, used to re-link note images imported from
  // the old app. If it is refused the repair flow falls back to the picker.
  await requestImageReadAccess()
  try {
    await Filesystem.requestPermissions()
  } catch {
    // denied or unsupported
  }
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
