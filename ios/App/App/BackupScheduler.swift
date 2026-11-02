import Foundation
import UIKit
import BackgroundTasks

/**
 * Copies the web layer's cache snapshot into `Documents/Clarity/` and keeps a
 * single backup, mirroring Android's nightly backup.
 *
 * iOS cannot run a job at an exact wall-clock time, so the 23:30 job is a
 * best-effort `BGAppRefreshTask`; the snapshot is also copied whenever the app
 * enters the background or comes back to the foreground. The folder is
 * visible in Files when `UIFileSharingEnabled` is on.
 */
enum BackupScheduler {
    static let taskIdentifier = "com.clarity.app.backup"

    private static let snapshotFile = "clarity-latest-backup.json"
    private static let filePrefix = "clarity_backup_"
    private static let folderName = "Clarity"
    private static let defaults = UserDefaults.standard
    private static let queue = DispatchQueue(label: "com.clarity.app.backup", qos: .utility)

    private static let stampFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyyMMdd_HHmm"
        return formatter
    }()

    /** Next 23:30 in the device's current time zone. */
    static func nextDeadline() -> Date {
        let calendar = Calendar.current
        var next = calendar.date(bySettingHour: 23, minute: 30, second: 0, of: Date()) ?? Date()
        if next <= Date() {
            next = calendar.date(byAdding: .day, value: 1, to: next) ?? next
        }
        return next
    }

    /** Call once from `application(_:didFinishLaunchingWithOptions:)`. */
    static func registerBackgroundTask() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: taskIdentifier,
            using: nil
        ) { task in
            guard let refresh = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            handle(refresh)
        }
    }

    private static func handle(_ task: BGAppRefreshTask) {
        scheduleNext()

        let lock = NSLock()
        var finished = false
        func finish(_ success: Bool) {
            lock.lock()
            defer { lock.unlock() }
            if finished { return }
            finished = true
            task.setTaskCompleted(success: success)
        }

        task.expirationHandler = { finish(false) }
        queue.async {
            finish(copySnapshot())
        }
    }

    /** Ask iOS for the next 23:30 slot. Failures are expected (simulator,
     *  Background App Refresh disabled) and are harmless. */
    static func scheduleNext() {
        let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
        request.earliestBeginDate = nextDeadline()
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: taskIdentifier)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            // The app still backs up whenever it is backgrounded.
        }
    }

    /** Copy the cache snapshot into Documents/Clarity. Runs on `queue`. */
    @discardableResult
    static func copySnapshot() -> Bool {
        let fileManager = FileManager.default
        guard let cacheDirectory = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            record(error: "No cache directory")
            return false
        }
        let source = cacheDirectory.appendingPathComponent(snapshotFile)
        guard fileManager.fileExists(atPath: source.path) else {
            record(error: "No backup snapshot yet")
            return false
        }
        guard let documents = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else {
            record(error: "No documents directory")
            return false
        }

        let folder = documents.appendingPathComponent(folderName, isDirectory: true)
        do {
            try fileManager.createDirectory(at: folder, withIntermediateDirectories: true)
            let name = filePrefix + stampFormatter.string(from: Date()) + ".json"
            let target = folder.appendingPathComponent(name)
            if fileManager.fileExists(atPath: target.path) {
                try fileManager.removeItem(at: target)
            }
            try fileManager.copyItem(at: source, to: target)
            prune(folder: folder, keeping: name)
            record(file: name, error: "")
            return true
        } catch {
            record(error: error.localizedDescription)
            return false
        }
    }

    /** Keep the copy off the main thread and use a background task so iOS
     *  gives it a moment to finish after the app leaves the foreground. */
    static func copySnapshotInBackground() {
        var identifier = UIBackgroundTaskIdentifier.invalid
        let finish: () -> Void = {
            if identifier != .invalid {
                UIApplication.shared.endBackgroundTask(identifier)
                identifier = .invalid
            }
        }
        identifier = UIApplication.shared.beginBackgroundTask(
            withName: "ClarityBackup",
            expirationHandler: finish
        )
        queue.async {
            _ = copySnapshot()
            DispatchQueue.main.async(execute: finish)
        }
    }

    private static func prune(folder: URL, keeping name: String) {
        let fileManager = FileManager.default
        guard let files = try? fileManager.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil) else {
            return
        }
        for file in files
        where file.lastPathComponent.hasPrefix(filePrefix) && file.lastPathComponent != name {
            try? fileManager.removeItem(at: file)
        }
    }

    private static func record(file: String = "", error: String) {
        defaults.set(Date().timeIntervalSince1970 * 1000, forKey: "lastBackupAt")
        defaults.set(file, forKey: "lastBackupFile")
        defaults.set(error, forKey: "lastError")
    }

    static func status() -> [String: Any] {
        [
            "lastBackupAt": defaults.double(forKey: "lastBackupAt"),
            "lastBackupFile": defaults.string(forKey: "lastBackupFile") ?? "",
            "lastError": defaults.string(forKey: "lastError") ?? ""
        ]
    }
}
