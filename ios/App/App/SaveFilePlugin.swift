import Foundation
import UIKit
import Capacitor

/**
 * iOS side of `SaveFile`: copies the already-exported backup to a temporary
 * file and lets the user place it anywhere in Files (On My iPhone, iCloud
 * Drive, …) with the system document picker. Mirrors Android's "Save as".
 *
 * Only the path of the file written by the web layer crosses the bridge.
 */
@objc(SaveFilePlugin)
public class SaveFilePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SaveFilePlugin"
    public let jsName = "SaveFile"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?
    private var pendingBytes = 0
    private var pendingName = "clarity-export.json"
    private var temporaryFile: URL?

    @objc func save(_ call: CAPPluginCall) {
        guard let sourcePath = call.getString("sourcePath"), !sourcePath.isEmpty else {
            call.reject("sourcePath is required")
            return
        }

        let filename = call.getString("filename") ?? "clarity-export.json"
        let sourceURL: URL
        if sourcePath.hasPrefix("file://"), let parsed = URL(string: sourcePath) {
            sourceURL = parsed
        } else {
            sourceURL = URL(fileURLWithPath: sourcePath)
        }

        let fileManager = FileManager.default
        guard fileManager.fileExists(atPath: sourceURL.path) else {
            call.reject("The export file is missing")
            return
        }

        guard let viewController = bridge?.viewController else {
            call.reject("No view controller to present the save dialog")
            return
        }

        // The export picker copies the file, so give it a correctly named copy
        // in the temporary directory and clean it up when the picker closes.
        let temporary = fileManager.temporaryDirectory.appendingPathComponent(filename)
        do {
            if fileManager.fileExists(atPath: temporary.path) {
                try fileManager.removeItem(at: temporary)
            }
            try fileManager.copyItem(at: sourceURL, to: temporary)
        } catch {
            call.reject("Could not prepare the backup: \(error.localizedDescription)")
            return
        }

        pendingCall = call
        pendingName = filename
        pendingBytes = (try? sourceURL.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
        temporaryFile = temporary

        let picker = UIDocumentPickerViewController(forExporting: [temporary], asCopy: true)
        picker.delegate = self
        DispatchQueue.main.async {
            viewController.present(picker, animated: true)
        }
    }

    private func cleanupTemporaryFile() {
        if let temporaryFile {
            try? FileManager.default.removeItem(at: temporaryFile)
        }
        temporaryFile = nil
    }
}

extension SaveFilePlugin: UIDocumentPickerDelegate {
    public func documentPicker(
        _ controller: UIDocumentPickerViewController,
        didPickDocumentsAt urls: [URL]
    ) {
        guard let call = pendingCall else { return }
        pendingCall = nil
        cleanupTemporaryFile()
        call.resolve([
            "bytes": pendingBytes,
            "location": urls.first?.lastPathComponent ?? pendingName
        ])
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        let call = pendingCall
        pendingCall = nil
        cleanupTemporaryFile()
        call?.resolve(["cancelled": true])
    }
}
