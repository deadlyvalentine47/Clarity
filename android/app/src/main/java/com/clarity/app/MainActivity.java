package com.clarity.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins: the "Save as" dialog, the nightly backup job and the
        // barometric altimeter used for run elevation.
        // Must be registered before super.onCreate.
        registerPlugin(SaveFilePlugin.class);
        registerPlugin(BackupSchedulerPlugin.class);
        registerPlugin(BarometerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
