package com.clarity.app;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;

import java.util.Calendar;
import java.util.concurrent.TimeUnit;

/**
 * Registers a daily backup job that runs at 23:30 device local time. Work is
 * persisted by WorkManager across app restarts and reboots; opening the app
 * re-aligns the next run to the coming 23:30.
 */
final class BackupScheduler {

    private static final String WORK_NAME = "clarity-nightly-backup";
    private static final String PREFS = "clarity_backup";
    private static final String KEY_LAST_AT = "lastBackupAt";
    private static final String KEY_LAST_FILE = "lastBackupFile";
    private static final String KEY_LAST_ERROR = "lastError";

    private BackupScheduler() {}

    static void schedule(Context context) {
        long next = next2330Millis();
        PeriodicWorkRequest request =
                new PeriodicWorkRequest.Builder(BackupWorker.class, 24, TimeUnit.HOURS)
                        // WorkManager's interval starts at the enqueue time, so an
                        // initial delay alone can let the *first* run fire as soon
                        // as the app is opened. The override pins the next run to
                        // an absolute local 23:30, independent of enqueue time.
                        .setNextScheduleTimeOverride(next)
                        .setInitialDelay(
                                Math.max(0, next - System.currentTimeMillis()),
                                TimeUnit.MILLISECONDS)
                        .addTag(WORK_NAME)
                        .build();
        WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request);
    }

    /** Next 23:30 in the device's current time zone, as an absolute timestamp. */
    private static long next2330Millis() {
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, 23);
        next.set(Calendar.MINUTE, 30);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) {
            next.add(Calendar.DAY_OF_MONTH, 1);
        }
        return next.getTimeInMillis();
    }

    static void record(Context context, long at, String file, String error) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit()
                .putLong(KEY_LAST_AT, at)
                .putString(KEY_LAST_FILE, file == null ? "" : file)
                .putString(KEY_LAST_ERROR, error == null ? "" : error)
                .apply();
    }

    static JSObject status(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSObject result = new JSObject();
        result.put("lastBackupAt", prefs.getLong(KEY_LAST_AT, 0));
        result.put("lastBackupFile", prefs.getString(KEY_LAST_FILE, ""));
        result.put("lastError", prefs.getString(KEY_LAST_ERROR, ""));
        return result;
    }
}
