package com.clarity.app;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayDeque;

/**
 * Barometric altimeter for run tracking.
 *
 * GNSS altitude is ±10-30 m, which cannot resolve the ~3 m between floors;
 * a pressure sensor resolves it to well under a metre. Readings are buffered
 * natively instead of pushed over the bridge: the WebView's JavaScript is
 * suspended when the screen locks, so a push would be dropped mid-run. The
 * web layer polls `drain()` instead and gets everything it missed.
 *
 * Altitude is reported relative to the pressure at `start()`, so no
 * sea-level calibration or network lookup is needed.
 *
 * TYPE_PRESSURE is not fitted to every phone — `isAvailable` reports that and
 * callers fall back to GNSS altitude.
 */
@CapacitorPlugin(name = "Barometer")
public class BarometerPlugin extends Plugin implements SensorEventListener {

    /** At ~5 Hz this is over an hour of readings; each entry is tiny. */
    private static final int MAX_READINGS = 20000;
    /** Standard barometric formula constant: 1 / 5.255. */
    private static final double ALTITUDE_EXPONENT = 0.1903;
    private static final double ALTITUDE_FACTOR = 44330.0;

    private final ArrayDeque<JSObject> readings = new ArrayDeque<>();
    private final Object lock = new Object();

    private SensorManager sensorManager;
    private Sensor pressureSensor;
    private Double baselinePressure;
    private boolean listening;

    @Override
    public void load() {
        Context context = getContext();
        sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            pressureSensor = sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE);
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", pressureSensor != null);
        call.resolve(result);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (pressureSensor == null || sensorManager == null) {
            call.reject("This device has no pressure sensor");
            return;
        }

        synchronized (lock) {
            readings.clear();
            baselinePressure = null;
        }

        if (!listening) {
            // SENSOR_DELAY_UI (~15 Hz) is far more than a barometer needs; the
            // sensor itself updates slowly, so this costs almost no battery.
            listening = sensorManager.registerListener(this, pressureSensor, SensorManager.SENSOR_DELAY_UI);
        }

        if (!listening) {
            call.reject("Could not start the pressure sensor");
            return;
        }

        call.resolve();
    }

    @PluginMethod
    public void drain(PluginCall call) {
        JSArray batch = new JSArray();
        synchronized (lock) {
            while (!readings.isEmpty()) {
                batch.put(readings.poll());
            }
        }
        JSObject result = new JSObject();
        result.put("readings", batch);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (listening && sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        listening = false;
        synchronized (lock) {
            readings.clear();
            baselinePressure = null;
        }
        call.resolve();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_PRESSURE) return;

        float pressure = event.values[0];
        if (pressure <= 0) return;

        synchronized (lock) {
            if (baselinePressure == null) baselinePressure = (double) pressure;
            double relative =
                ALTITUDE_FACTOR *
                    (1 - Math.pow(pressure / baselinePressure, ALTITUDE_EXPONENT));

            JSObject reading = new JSObject();
            reading.put("t", System.currentTimeMillis());
            reading.put("relativeAltitude", relative);
            readings.add(reading);
            if (readings.size() > MAX_READINGS) readings.poll();
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Pressure accuracy is not reported usefully; nothing to do.
    }
}
