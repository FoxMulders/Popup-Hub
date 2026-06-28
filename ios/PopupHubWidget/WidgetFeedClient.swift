import Foundation

enum WidgetSharedKeys {
    static let appGroup = "group.ca.popuphub.app"
    static let tokenKey = "widget_auth_token"
    static let snapshotKey = "widget_snapshot_json"
    static let defaultApiBase = "https://popuphub.ca"
}

struct WidgetSnapshot: Codable {
    let userId: String
    let role: String
    let activePortal: String
    let persona: String
    let apiBaseUrl: String
    let savedAt: String
}

struct WidgetFeedEnvelope: Codable {
    let persona: String
    let generatedAt: String
    let summary: WidgetSummary?
    let unreadNotifications: Int?
    let nearbyMarkets: [WidgetMarket]?
    let favoriteMarkets: [WidgetMarket]?
    let nextMarketCountdownMs: Double?
    let notifications: [WidgetNotification]?
    let funds: WidgetFunds?
    let applications: WidgetApplications?
    let eventPulse: WidgetEventPulse?
    let approvalQueue: [WidgetApprovalItem]?
    let vendorOfTheDay: WidgetVendorSpotlight?
    let recentActivity: [WidgetActivityItem]?
    let discoverDeepLink: String?
    let notificationsDeepLink: String?
    let activeMarket: WidgetMarket?
    let dailyInterestCount: Int?
    let latestVendorMessage: WidgetVendorMessage?
}

struct WidgetSummary: Codable {
    let statusLine: String
    let theme: String
    let unread: Int
    let balanceLabel: String?
}

struct WidgetMarket: Codable {
    let id: String
    let name: String
    let status: String
    let startAt: String?
    let deepLink: String
}

struct WidgetNotification: Codable {
    let id: String
    let message: String
    let deepLink: String?
}

struct WidgetFunds: Codable {
    let balanceCents: Int
    let addFundsDeepLink: String
}

struct WidgetApplications: Codable {
    let approvedCount: Int
    let pendingReviewCount: Int
    let paymentDueCount: Int
    let applicationsDeepLink: String
}

struct WidgetEventPulse: Codable {
    let activeCount: Int
    let preparingCount: Int
    let actionRequiredCount: Int
    let pendingApplicationsCount: Int
    let boothFeesCollectedCents: Int
    let boothFeesOutstandingCents: Int
    let occupancyPercent: Int?
    let checkInProgress: WidgetCheckInProgress?
    let checkInDeepLink: String?
    let studioDeepLink: String
    let nextEvent: WidgetMarket?
}

struct WidgetCheckInProgress: Codable {
    let checkedIn: Int
    let total: Int
}

struct WidgetApprovalItem: Codable {
    let id: String
    let vendorName: String
    let eventName: String
    let deepLink: String
}

struct WidgetVendorSpotlight: Codable {
    let vendorId: String
    let businessName: String
    let deepLink: String
}

struct WidgetActivityItem: Codable {
    let id: String
    let message: String
    let deepLink: String
}

struct WidgetVendorMessage: Codable {
    let vendorName: String
    let snippet: String
    let deepLink: String
}

struct WidgetSession {
    let token: String
    let snapshot: WidgetSnapshot
}

enum WidgetFeedClient {
    static func loadSession() -> WidgetSession? {
        guard let defaults = UserDefaults(suiteName: WidgetSharedKeys.appGroup),
              let token = defaults.string(forKey: WidgetSharedKeys.tokenKey),
              let snapshotJson = defaults.string(forKey: WidgetSharedKeys.snapshotKey),
              let data = snapshotJson.data(using: .utf8),
              let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
        else { return nil }
        return WidgetSession(token: token, snapshot: snapshot)
    }

    static func fetchFeed(session: WidgetSession) async -> WidgetFeedEnvelope? {
        let base = session.snapshot.apiBaseUrl.isEmpty ? WidgetSharedKeys.defaultApiBase : session.snapshot.apiBaseUrl
        guard let url = URL(string: "\(base)/api/widget/feed") else { return nil }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(session.token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return nil
            }
            return try JSONDecoder().decode(WidgetFeedEnvelope.self, from: data)
        } catch {
            return nil
        }
    }

    static func postAction(session: WidgetSession, action: String, extras: [String: String] = [:]) async -> Bool {
        let base = session.snapshot.apiBaseUrl.isEmpty ? WidgetSharedKeys.defaultApiBase : session.snapshot.apiBaseUrl
        guard let url = URL(string: "\(base)/api/widget/action") else { return false }

        var payload: [String: Any] = ["action": action]
        for (key, value) in extras { payload[key] = value }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(session.token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return false }
            return (200...299).contains(http.statusCode)
        } catch {
            return false
        }
    }

    static func deepLinkURL(_ path: String?) -> URL? {
        guard let path, !path.isEmpty else { return URL(string: "ca.popuphub.app://discover") }
        if path.hasPrefix("http") { return URL(string: path) }
        let normalized = path.hasPrefix("/") ? path : "/\(path)"
        return URL(string: "https://popuphub.ca\(normalized)")
    }
}
