package com.clarity.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugin: read access to images in shared storage (see
        // MediaPermissionPlugin). Must be registered before super.onCreate.
        registerPlugin(MediaPermissionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
