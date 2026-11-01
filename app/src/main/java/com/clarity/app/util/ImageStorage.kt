package com.clarity.app.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/**
 * Stores note images.
 *
 * Images are written directly to the public folder
 * `/storage/emulated/0/clarity/pics` (requires All Files Access).
 * On API 26-28 the WRITE_EXTERNAL_STORAGE permission is used instead.
 * If no public-storage access is granted, images fall back to the
 * app-specific external dir (`Android/data/<package>/files/clarity/pics`).
 */
object ImageStorage {
    private const val MAX_DIMENSION = 1280
    private const val JPEG_QUALITY = 80

    private val markerPattern = Regex("""!\[img:([a-fA-F0-9\-]+)\]""")

    private fun imageDir(context: Context): File =
        if (StoragePermission.hasAllFilesAccess(context)) {
            StoragePermission.publicDir(context, AppStorage.PICS)
        } else {
            AppStorage.dir(context, AppStorage.PICS)
        }

    private fun imageFile(context: Context, uuid: String): File =
        File(imageDir(context), "$uuid.jpg")

    private fun findImageFile(context: Context, uuid: String): File {
        val publicFile = File(StoragePermission.publicDir(context, AppStorage.PICS), "$uuid.jpg")
        if (publicFile.exists()) return publicFile
        return File(AppStorage.dir(context, AppStorage.PICS), "$uuid.jpg")
    }

    fun extractUuid(line: String): String? {
        val trimmed = line.trim()
        if (!trimmed.startsWith("![img:") || !trimmed.endsWith("]")) return null
        val uuid = trimmed.removePrefix("![img:").removeSuffix("]")
        return uuid.takeIf { it.isNotBlank() }
    }

    fun marker(uuid: String): String = "![img:$uuid]"

    /** Model for Coil: the image file path. */
    fun imageModel(context: Context, uuid: String): Any =
        findImageFile(context, uuid)

    fun saveImage(context: Context, bytes: ByteArray): String {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
            throw IllegalStateException("Could not read image size (w=${bounds.outWidth} h=${bounds.outHeight})")
        }

        var sampleSize = 1
        while (bounds.outWidth / (sampleSize * 2) >= MAX_DIMENSION ||
            bounds.outHeight / (sampleSize * 2) >= MAX_DIMENSION
        ) {
            sampleSize *= 2
        }
        val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sampleSize }
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, decodeOpts)
            ?: throw IllegalStateException("Could not decode picked image")

        val scale = if (bitmap.width > MAX_DIMENSION || bitmap.height > MAX_DIMENSION) {
            MAX_DIMENSION.toFloat() / maxOf(bitmap.width, bitmap.height)
        } else 1f

        val resized = if (scale < 1f) {
            Bitmap.createScaledBitmap(
                bitmap,
                (bitmap.width * scale).toInt().coerceAtLeast(1),
                (bitmap.height * scale).toInt().coerceAtLeast(1),
                true
            )
        } else {
            bitmap
        }

        val uuid = UUID.randomUUID().toString()
        val file = imageFile(context, uuid)
        FileOutputStream(file).use { out ->
            resized.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
        }

        if (resized !== bitmap) resized.recycle()
        bitmap.recycle()
        Log.d("ImageStorage", "saved image to $file")
        return uuid
    }

    fun deleteImages(context: Context, content: String) {
        markerPattern.findAll(content).forEach { match ->
            val uuid = match.groupValues[1]
            File(StoragePermission.publicDir(context, AppStorage.PICS), "$uuid.jpg").takeIf { it.exists() }?.delete()
            File(AppStorage.dir(context, AppStorage.PICS), "$uuid.jpg").takeIf { it.exists() }?.delete()
        }
    }
}
