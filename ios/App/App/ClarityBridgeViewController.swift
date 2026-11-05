import UIKit
import Capacitor

/** Registers the app-local plugins that mirror the Android ones. */
class ClarityBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SaveFilePlugin())
        bridge?.registerPluginInstance(BackupSchedulerPlugin())
        bridge?.registerPluginInstance(BarometerPlugin())
    }
}
