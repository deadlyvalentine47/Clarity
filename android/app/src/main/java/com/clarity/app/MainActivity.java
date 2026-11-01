package com.clarity.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugin: the system "Save as" dialog used by Export data.
        // Must be registered before super.onCreate.
        registerPlugin(SaveFilePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
