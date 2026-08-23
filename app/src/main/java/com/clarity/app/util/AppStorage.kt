package com.clarity.app.util

import android.content.Context
import java.io.File

/**
 * Single source of truth for app-owned storage.
 *
 * Every file the app stores lives under the top-level `clarity/`
 * folder (on API 29+ that's the public `/storage/emulated/0/clarity`,
 * visible in the file manager). Inside it we keep separate
 * subfolders by type:
 *
 *  - [pics]    -> images  (`clarity/pics`)
 *  - [videos]  -> videos  (`clarity/videos`)
 *  - [files]   -> docs / json / code / misc (`clarity/files`)
 *  - [notes]   -> note exports & backups (`clarity/notes`)
 *
 * New content types should add a corresponding named subfolder here so
 * all storage stays organized and discoverable.
 */
object AppStorage {
    const val ROOT_DIR_NAME = "clarity"

    const val PICS = "pics"
    const val VIDEOS = "videos"
    const val FILES = "files"
    const val NOTES = "notes"

    /** Public relative path used with MediaStore (e.g. for images). */
    fun mediaPath(dirName: String): String = "$ROOT_DIR_NAME/$dirName"

    fun rootDir(context: Context): File =
        (context.getExternalFilesDir(null)?.let { File(it, ROOT_DIR_NAME) }
            ?: File(context.filesDir, ROOT_DIR_NAME)).apply { mkdirs() }

    /** Returns (and creates) `<root>/<segments...>`. */
    fun dir(context: Context, vararg segments: String): File =
        segments.fold(rootDir(context)) { dir, segment -> File(dir, segment) }.apply { mkdirs() }
}