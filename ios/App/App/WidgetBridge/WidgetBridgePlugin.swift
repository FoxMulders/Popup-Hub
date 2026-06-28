import Foundation
import Capacitor
import WidgetKit

enum WidgetSharedKeys {
    static let appGroup = "group.ca.popuphub.app"
    static let tokenKey = "widget_auth_token"
    static let snapshotKey = "widget_snapshot_json"
}

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    @objc func save(_ call: CAPPluginCall) {
        guard let token = call.getString("token"),
              let snapshotJson = call.getString("snapshotJson") else {
            call.reject("token and snapshotJson required")
            return
        }

        let defaults = UserDefaults(suiteName: WidgetSharedKeys.appGroup)
        defaults?.set(token, forKey: WidgetSharedKeys.tokenKey)
        defaults?.set(snapshotJson, forKey: WidgetSharedKeys.snapshotKey)

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }

        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        let defaults = UserDefaults(suiteName: WidgetSharedKeys.appGroup)
        defaults?.removeObject(forKey: WidgetSharedKeys.tokenKey)
        defaults?.removeObject(forKey: WidgetSharedKeys.snapshotKey)

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }

        call.resolve()
    }
}
