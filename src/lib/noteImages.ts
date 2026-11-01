// Note images are stored as blobs in IndexedDB. Backups (from this app or the
// old Kotlin one) only carry the `![img:uuid]` markers, never the bytes — the
// old app kept them as JPEGs in the public `clarity/pics` folder. So after
// importing a backup the markers are intact but the blobs are missing.
//
// This module re-links them: first by reading `clarity/pics/<uuid>.jpg` from
// shared storage (works where the OS grants read access), otherwise by asking
// the user to pick the files, whose names still are the uuids.
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { db } from '../db/db'
import { downscaleImage, extractImageIds, saveNoteImageBlob } from '../db/notes'
import { requestImageReadAccess } from './native'

/** Folder the old Android app wrote to, relative to shared storage. */
const PICS_FOLDER = 'clarity/pics'
const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const

export interface MissingImages {
  ids: string[]
  referenced: number
}

/** Image ids referenced by note text that have no blob stored locally. */
export async function findMissingImages(): Promise<MissingImages> {
  const notes = await db.notes.toArray()
  const referenced = new Set<string>()
  for (const note of notes) for (const id of extractImageIds(note.content ?? '')) referenced.add(id)

  if (referenced.size === 0) return { ids: [], referenced: 0 }

  const stored = new Set(await db.noteImages.toCollection().primaryKeys())
  return {
    ids: [...referenced].filter((id) => !stored.has(id)),
    referenced: referenced.size,
  }
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

function typeFor(extension: string): string {
  return extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg'
}

async function storeImage(id: string, blob: Blob): Promise<void> {
  const shrunk = await downscaleImage(blob)
  await saveNoteImageBlob(id, shrunk)
}

export interface FolderRepairResult {
  recovered: number
  failed: number
  /** Set when shared storage could not be read at all (permission). */
  unreadable: boolean
}

/**
 * Read the old app's images straight from `clarity/pics`. We only ever read
 * files whose names we already know, so no directory listing is needed.
 */
export async function repairImagesFromFolder(ids: string[]): Promise<FolderRepairResult> {
  const result: FolderRepairResult = { recovered: 0, failed: 0, unreadable: false }
  if (!Capacitor.isNativePlatform() || ids.length === 0) return result

  await requestImageReadAccess()
  try {
    await Filesystem.requestPermissions()
  } catch {
    // Denied or not applicable on this Android version.
  }

  for (const id of ids) {
    let done = false
    for (const extension of EXTENSIONS) {
      try {
        const { data } = await Filesystem.readFile({
          path: `${PICS_FOLDER}/${id}.${extension}`,
          directory: Directory.ExternalStorage,
        })
        if (typeof data !== 'string') continue
        await storeImage(id, base64ToBlob(data, typeFor(extension)))
        result.recovered += 1
        done = true
        break
      } catch {
        // Try the next extension; a hard permission failure is detected below.
      }
    }
    if (!done) result.failed += 1
  }

  // Nothing readable at all almost always means no storage access.
  result.unreadable = result.recovered === 0 && result.failed === ids.length
  return result
}

export interface PickedRepairResult {
  recovered: number
  unmatched: number
}

/**
 * Match picked files to missing markers by filename (`<uuid>.jpg`). Works in
 * the browser too, and in the APK it opens the system picker, which needs no
 * storage permission.
 */
export async function repairImagesFromFiles(
  files: File[],
  ids: string[],
): Promise<PickedRepairResult> {
  const wanted = new Set(ids.map((id) => id.toLowerCase()))
  let recovered = 0
  let unmatched = 0

  for (const file of files) {
    const name = file.name.replace(/\.[^.]+$/, '').toLowerCase()
    if (!wanted.has(name)) {
      unmatched += 1
      continue
    }
    try {
      await storeImage(name, file)
      wanted.delete(name)
      recovered += 1
    } catch {
      unmatched += 1
    }
  }

  return { recovered, unmatched }
}
