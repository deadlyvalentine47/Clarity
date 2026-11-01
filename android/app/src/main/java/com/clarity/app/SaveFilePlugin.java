package com.clarity.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Saves text to a location the user picks, via the Storage Access Framework.
 *
 * The WebView ignores `<a download>` and the share sheet has no "save to
 * device" target on most phones, so backups need ACTION_CREATE_DOCUMENT to get
 * a real "Save as" dialog (local storage, Drive, ...). No permission required.
 */
@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String filename = call.getString("filename", "clarity-export.json");
        String mimeType = call.getString("mimeType", "application/json");

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, filename);

        startActivityForResult(call, intent, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            // The user backed out of the picker.
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }

        Uri uri = result.getData().getData();
        String data = call.getString("data", "");

        try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri)) {
            if (stream == null) {
                call.reject("Could not open the selected file for writing");
                return;
            }
            stream.write(data.getBytes(StandardCharsets.UTF_8));
            stream.flush();

            JSObject saved = new JSObject();
            saved.put("uri", uri.toString());
            call.resolve(saved);
        } catch (Exception error) {
            call.reject("Could not write the file: " + error.getMessage(), error);
        }
    }
}
