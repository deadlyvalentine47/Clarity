package com.clarity.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Puts an exported backup somewhere the user can find it.
 *
 * Android 10+ writes straight to `Downloads/Clarity/` through MediaStore: no
 * permission, no picker, and — importantly — no activity switch, so a large
 * backup never has to survive the WebView being backgrounded. Android 7-9 has
 * no permissionless Downloads access, so those fall back to the Storage Access
 * Framework ("Save as" dialog), which grants access to the one chosen file.
 *
 * Only the path of the file already written to the app cache crosses the
 * bridge. Passing the JSON itself through the plugin call is what killed the
 * app and left a 0-byte file behind.
 */
@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String sourcePath = call.getString("sourcePath");

        if (sourcePath == null || sourcePath.isEmpty()) {
            call.reject("sourcePath is required");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveToDownloads(call, sourcePath);
            return;
        }

        // Older releases: let the user choose, via SAF.
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mimeType", "application/json"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("filename", "clarity-export.json"));
        startActivityForResult(call, intent, "saveResult");
    }

    // ------------------------------------------------------------- Android 10+

    private void saveToDownloads(PluginCall call, String sourcePath) {
        String filename = call.getString("filename", "clarity-export.json");
        String mimeType = call.getString("mimeType", "application/json");
        String folder = Environment.DIRECTORY_DOWNLOADS + "/Clarity";

        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, folder);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri target = null;

        try {
            target = getContext().getContentResolver().insert(collection, values);
            if (target == null) {
                call.reject("Could not create the file in Downloads");
                return;
            }

            long copied = copy(sourcePath, target);

            ContentValues published = new ContentValues();
            published.put(MediaStore.MediaColumns.IS_PENDING, 0);
            getContext().getContentResolver().update(target, published, null, null);

            JSObject saved = new JSObject();
            saved.put("uri", target.toString());
            saved.put("bytes", copied);
            saved.put("location", folder + "/" + filename);
            call.resolve(saved);
        } catch (Exception error) {
            if (target != null) {
                try {
                    getContext().getContentResolver().delete(target, null, null);
                } catch (Exception ignored) {
                    // nothing to clean up
                }
            }
            call.reject("Could not save the backup: " + error.getMessage(), error);
        }
    }

    // -------------------------------------------------------------- Android 7-9

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            // The app was restarted while the picker was open; the cached copy
            // is still on disk, so the user can simply export again.
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }

        Uri target = result.getData().getData();
        String sourcePath = call.getString("sourcePath", "");

        try {
            long copied = copy(sourcePath, target);

            JSObject saved = new JSObject();
            saved.put("uri", target.toString());
            saved.put("bytes", copied);
            call.resolve(saved);
        } catch (Exception error) {
            call.reject("Could not write the file: " + error.getMessage(), error);
        }
    }

    // ------------------------------------------------------------------ helpers

    private long copy(String sourcePath, Uri target) throws Exception {
        File source = new File(pathOf(sourcePath));
        long copied = 0;

        try (InputStream input = new FileInputStream(source);
             OutputStream output = getContext().getContentResolver().openOutputStream(target)) {
            if (output == null) {
                throw new Exception("Could not open the selected file for writing");
            }
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = input.read(buffer)) > 0) {
                output.write(buffer, 0, read);
                copied += read;
            }
            output.flush();
        }

        return copied;
    }

    /** Accepts both "file:///..." and a plain filesystem path. */
    private String pathOf(String path) {
        if (path.startsWith("file://")) {
            Uri uri = Uri.parse(path);
            return uri.getPath() != null ? uri.getPath() : path;
        }
        return path;
    }
}
