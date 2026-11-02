package com.clarity.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins: the "Save as" dialog and the nightly backup job.
        // Must be registered before super.onCreate.
        registerPlugin(SaveFilePlugin.class);
        registerPlugin(BackupSchedulerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
