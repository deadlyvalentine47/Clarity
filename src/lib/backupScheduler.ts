import { Capacitor, registerPlugin } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { exportData } from './exportImport'
import type { Preferences } from './prefs'

/** Cache file the native worker copies out at 23:30 (Downloads/Clarity on
 *  Android, Files → Clarity on iOS). */
const SNAPSHOT_FILE = 'clarity-latest-backup.json'

export interface BackupStatus {
  lastBackupAt: number
  lastBackupFile: string
  lastError: string
}

interface ClarityBackupPlugin {
  /** (Re)schedule the daily 23:30 backup. Idempotent. */
  schedule(): Promise<{ scheduled: boolean }>
  status(): Promise<BackupStatus>
}

const ClarityBackup = registerPlugin<ClarityBackupPlugin>('ClarityBackup')

let writing: Promise<void> | null = null
let scheduled = false

/**
 * Write the current database to the app cache. The nightly native worker
 * only copies this file, so the WebView never has to be running at 23:30.
 */
export function writeBackupSnapshot(prefs: Preferences): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve()
  if (writing) return writing

  writing = (async () => {
    try {
      const json = await exportData(prefs)
      await Filesystem.writeFile({
        path: SNAPSHOT_FILE,
        data: json,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      })
    } catch {
      // Best effort — the worker keeps the previous snapshot.
    } finally {
      writing = null
    }
  })()

  return writing
}

/** Register the daily native job once per app launch. */
export async function scheduleNightlyBackup(): Promise<void> {
  if (!Capacitor.isNativePlatform() || scheduled) return
  scheduled = true
  try {
    await ClarityBackup.schedule()
  } catch {
    scheduled = false
  }
}

export async function backupStatus(): Promise<BackupStatus | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    return await ClarityBackup.status()
  } catch {
    return null
  }
}
