package com.clarity.app.util

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.ContextCompat

/**
 * Helpers for public-storage access.
 *
 * The app keeps all its data under the public top-level `clarity/`
 * folder (`/storage/emulated/0/clarity`). On Android 11+ (API 30+)
 * creating that folder requires the "All files access"
 * (MANAGE_EXTERNAL_STORAGE) permission, which the user grants once
 * from the app's "App info -> All files access" settings screen.
 */
object StoragePermission {

    fun hasAllFilesAccess(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE) ==
                PackageManager.PERMISSION_GRANTED
        }

    /** Opens the system screen where the user can grant "All files access". */
    fun requestAllFilesAccess(context: Context) {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                data = Uri.parse("package:${context.packageName}")
            }
        } else {
            Intent(Settings.ACTION_MANAGE_APPLICATIONS_SETTINGS)
        }
        context.startActivity(intent)
    }

    /** Public top-level folder: `/storage/emulated/0/clarity`. */
    fun publicRootDir(context: Context): java.io.File =
        java.io.File(Environment.getExternalStorageDirectory(), AppStorage.ROOT_DIR_NAME)

    /** Public subfolder, e.g. `clarity/pics`. */
    fun publicDir(context: Context, vararg segments: String): java.io.File =
        segments.fold(publicRootDir(context)) { dir, seg ->
            java.io.File(dir, seg)
        }.apply { mkdirs() }
}
