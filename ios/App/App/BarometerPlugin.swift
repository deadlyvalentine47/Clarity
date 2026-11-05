import Foundation
import Capacitor
import CoreMotion

/**
 * iOS side of `Barometer`. CMAltimeter reports barometric altimeter updates
 * relative to when tracking started (metres, sub-decimetre resolution), which
 * is exactly what a run needs: five floors is ~15 m, far below what GNSS
 * altitude can resolve.
 *
 * Readings are buffered here rather than pushed over the bridge, because the
 * WebView is suspended while the screen is locked. The web layer polls
 * `drain()` and receives everything it missed.
 *
 * Requires NSMotionUsageDescription in Info.plist. Without a barometer
 * (iPad, iPod touch, iPhone 5s and earlier) `isAvailable` is false and the
 * web layer falls back to GNSS altitude.
 */
@objc(BarometerPlugin)
public class BarometerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BarometerPlugin"
    public let jsName = "Barometer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "drain", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private let altimeter = CMAltimeter()
    private let lock = NSLock()
    private var readings: [[String: Any]] = []
    private var running = false
    private let maxReadings = 20000

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": CMAltimeter.isRelativeAltitudeAvailable()])
    }

    @objc func start(_ call: CAPPluginCall) {
        guard CMAltimeter.isRelativeAltitudeAvailable() else {
            call.reject("This device has no barometer")
            return
        }
        guard !running else {
            call.resolve()
            return
        }

        lock.lock()
        readings.removeAll(keepingCapacity: true)
        lock.unlock()

        running = true
        altimeter.startRelativeAltitudeUpdates(to: OperationQueue.main) { [weak self] data, _ in
            guard let self, let data else { return }
            let entry: [String: Any] = [
                "t": Date().timeIntervalSince1970 * 1000,
                "relativeAltitude": data.relativeAltitude.doubleValue,
            ]
            self.lock.lock()
            self.readings.append(entry)
            if self.readings.count > self.maxReadings {
                self.readings.removeFirst()
            }
            self.lock.unlock()
        }

        call.resolve()
    }

    @objc func drain(_ call: CAPPluginCall) {
        lock.lock()
        let batch = readings
        readings.removeAll(keepingCapacity: true)
        lock.unlock()
        call.resolve(["readings": batch])
    }

    @objc func stop(_ call: CAPPluginCall) {
        if running {
            altimeter.stopRelativeAltitudeUpdates()
            running = false
        }
        lock.lock()
        readings.removeAll(keepingCapacity: true)
        lock.unlock()
        call.resolve()
    }
}
