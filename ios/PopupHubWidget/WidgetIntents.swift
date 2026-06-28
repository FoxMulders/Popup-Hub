import AppIntents
import WidgetKit

@available(iOS 17.0, *)
struct RefreshWidgetIntent: AppIntent {
    static var title: LocalizedStringResource = "Refresh Popup Hub"
    static var description = IntentDescription("Fetch the latest widget data.")

    func perform() async throws -> some IntentResult {
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

@available(iOS 17.0, *)
struct VendorCheckInIntent: AppIntent {
    static var title: LocalizedStringResource = "Check in at booth"
    static var description = IntentDescription("Mark your booth as arrived.")

    func perform() async throws -> some IntentResult {
        guard let session = WidgetFeedClient.loadSession() else { return .result() }
        _ = await WidgetFeedClient.postAction(session: session, action: "checkin")
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

@available(iOS 17.0, *)
struct ToggleMarketFilterIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle market filter"
    static var description = IntentDescription("Cycle farmers / artisan market filters.")

    func perform() async throws -> some IntentResult {
        guard let session = WidgetFeedClient.loadSession() else { return .result() }
        _ = await WidgetFeedClient.postAction(session: session, action: "toggleFilter")
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

@available(iOS 17.0, *)
struct CoordinatorBroadcastIntent: AppIntent {
    static var title: LocalizedStringResource = "Broadcast market update"
    static var description = IntentDescription("Send a quick announcement to followers.")

    @Parameter(title: "Event ID")
    var eventId: String

    @Parameter(title: "Message")
    var message: String

    func perform() async throws -> some IntentResult {
        guard let session = WidgetFeedClient.loadSession() else { return .result() }
        _ = await WidgetFeedClient.postAction(
            session: session,
            action: "broadcast",
            extras: ["eventId": eventId, "message": message]
        )
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

@available(iOS 17.0, *)
struct PopupHubWidgetRelevance: AppIntent {
    static var title: LocalizedStringResource = "Popup Hub context"

    func perform() async throws -> some IntentResult {
        .result()
    }
}
