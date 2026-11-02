package com.clarity.app;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Copies the latest backup snapshot written by the web layer into the device's
 * Downloads/Clarity folder, timestamped, and removes the previous backup so
 * only the newest one remains.
 *
 * The snapshot lives in the app cache; the WebView does not need to be running
 * when this worker fires.
 */
public class BackupWorker extends Worker {

    private static final String SNAPSHOT = "clarity-latest-backup.json";
    private static final String PREFIX = "clarity_backup_";
    private static final String FOLDER = Environment.DIRECTORY_DOWNLOADS + "/Clarity";

    public BackupWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        File source = new File(context.getCacheDir(), SNAPSHOT);

        if (!source.exists() || source.length() == 0) {
            // Nothing has been written yet; try again on the next run rather
            // than reporting an error every night.
            BackupScheduler.record(context, System.currentTimeMillis(), "", "No backup snapshot yet");
            // Keep the next run pinned to 23:30 instead of drifting with the
            // actual (possibly delayed) run time.
            BackupScheduler.schedule(context);
            return Result.success();
        }

        String filename =
                PREFIX + new SimpleDateFormat("yyyyMMdd_HHmm", Locale.US).format(new Date()) + ".json";

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                saveViaMediaStore(context, source, filename);
            } else {
                saveToAppDownloads(context, source, filename);
            }
            BackupScheduler.record(context, System.currentTimeMillis(), filename, "");
            // Re-pin tomorrow's run to 23:30. WorkManager clears the override
            // once this run finishes, and interval-based scheduling would
            // otherwise drift by however late the system started us.
            BackupScheduler.schedule(context);
            return Result.success();
        } catch (Exception error) {
            BackupScheduler.record(context, System.currentTimeMillis(), "", error.getMessage());
            return Result.retry();
        }
    }

    // -------------------------------------------------------------- Android 10+

    private void saveViaMediaStore(Context context, File source, String filename) throws Exception {
        ContentResolver resolver = context.getContentResolver();
        Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);

        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, FOLDER);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri target = resolver.insert(collection, values);
        if (target == null) throw new Exception("Could not create the backup file");

        try {
            try (InputStream input = new FileInputStream(source);
                 OutputStream output = resolver.openOutputStream(target)) {
                if (output == null) throw new Exception("Could not open the backup for writing");
                copy(input, output);
            }

            ContentValues published = new ContentValues();
            published.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(target, published, null, null);
        } catch (Exception error) {
            try {
                resolver.delete(target, null, null);
            } catch (Exception ignored) {
                // nothing to clean up
            }
            throw error;
        }

        // Pruning must never turn a successful write into a retry.
        try {
            deleteOlderViaMediaStore(resolver, collection, filename);
        } catch (Exception ignored) {
            // the new backup is already in place
        }
    }

    private void deleteOlderViaMediaStore(
            ContentResolver resolver, Uri collection, String keep) {
        String selection =
                MediaStore.MediaColumns.RELATIVE_PATH + " LIKE ? AND "
                        + MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ?";
        String[] args = {FOLDER + "%", PREFIX + "%"};

        String[] projection = {
                MediaStore.MediaColumns._ID,
                MediaStore.MediaColumns.DISPLAY_NAME,
        };

        try (Cursor cursor = resolver.query(collection, projection, selection, args, null)) {
            if (cursor == null) return;
            int idColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID);
            int nameColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME);
            while (cursor.moveToNext()) {
                String name = cursor.getString(nameColumn);
                if (name == null || name.equals(keep)) continue;
                Uri row = ContentUris.withAppendedId(collection, cursor.getLong(idColumn));
                try {
                    resolver.delete(row, null, null);
                } catch (Exception ignored) {
                    // owned by another install; leave it alone
                }
            }
        }
    }

    // -------------------------------------------------------------- Android 7-9

    private void saveToAppDownloads(Context context, File source, String filename) throws Exception {
        File base = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (base == null) base = context.getFilesDir();
        File dir = new File(base, "Clarity");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("Could not create the backup folder");

        File target = new File(dir, filename);
        try (InputStream input = new FileInputStream(source);
             OutputStream output = new FileOutputStream(target)) {
            copy(input, output);
        }

        File[] existing = dir.listFiles();
        if (existing != null) {
            for (File file : existing) {
                if (file.getName().startsWith(PREFIX) && !file.getName().equals(filename)) {
                    //noinspection ResultOfMethodCallIgnored
                    file.delete();
                }
            }
        }
    }

    private static void copy(InputStream input, OutputStream output) throws Exception {
        byte[] buffer = new byte[16 * 1024];
        int read;
        while ((read = input.read(buffer)) > 0) {
            output.write(buffer, 0, read);
        }
        output.flush();
    }
}
