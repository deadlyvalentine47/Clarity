package com.clarity.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Bridge for the daily 23:30 backup job (see BackupWorker). */
@CapacitorPlugin(name = "ClarityBackup")
public class BackupSchedulerPlugin extends Plugin {

    @PluginMethod
    public void schedule(PluginCall call) {
        BackupScheduler.schedule(getContext());
        JSObject result = new JSObject();
        result.put("scheduled", true);
        call.resolve(result);
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(BackupScheduler.status(getContext()));
    }
}
