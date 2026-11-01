package com.clarity.app;

import android.Manifest;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Asks for read access to images in shared storage.
 *
 * Needed to re-link the note pictures the old Kotlin app wrote to
 * /storage/emulated/0/clarity/pics: on Android 13+ the generic storage
 * permission the Filesystem plugin requests no longer exists, and images are
 * guarded by READ_MEDIA_IMAGES instead. Below 13 the older permission covers
 * it, so the call succeeds without a prompt.
 */
@CapacitorPlugin(
    name = "MediaPermission",
    permissions = {
        @Permission(alias = "images", strings = { Manifest.permission.READ_MEDIA_IMAGES })
    }
)
public class MediaPermissionPlugin extends Plugin {

    @PluginMethod
    public void request(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAlias("images", call, "permissionCallback");
            return;
        }
        resolve(call, true);
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        resolve(call, getPermissionState("images") == PermissionState.GRANTED);
    }

    private void resolve(PluginCall call, boolean granted) {
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }
}
