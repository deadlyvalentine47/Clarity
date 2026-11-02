import UIKit
import Capacitor

/** Bridge for the backup coordinator (see BackupScheduler.swift). */
@objc(BackupSchedulerPlugin)
public class BackupSchedulerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BackupSchedulerPlugin"
    public let jsName = "ClarityBackup"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "schedule", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc func schedule(_ call: CAPPluginCall) {
        BackupScheduler.scheduleNext()
        BackupScheduler.copySnapshotInBackground()
        call.resolve(["scheduled": true])
    }

    @objc func status(_ call: CAPPluginCall) {
        call.resolve(BackupScheduler.status())
    }

    @objc private func appWillEnterForeground() {
        BackupScheduler.copySnapshotInBackground()
    }

    @objc private func appDidEnterBackground() {
        BackupScheduler.scheduleNext()
        BackupScheduler.copySnapshotInBackground()
    }
}
