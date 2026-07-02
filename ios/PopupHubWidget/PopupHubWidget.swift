import WidgetKit
import SwiftUI

struct PopupHubWidgetEntry: TimelineEntry {
    let date: Date
    let session: WidgetSession?
    let feed: WidgetFeedEnvelope?
    let isPlaceholder: Bool
}

struct PopupHubWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> PopupHubWidgetEntry {
        PopupHubWidgetEntry(date: Date(), session: nil, feed: nil, isPlaceholder: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (PopupHubWidgetEntry) -> Void) {
        Task {
            let session = WidgetFeedClient.loadSession()
            var feed: WidgetFeedEnvelope?
            if let session {
                feed = await WidgetFeedClient.fetchFeed(session: session)
            }
            completion(PopupHubWidgetEntry(date: Date(), session: session, feed: feed, isPlaceholder: context.isPreview))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PopupHubWidgetEntry>) -> Void) {
        Task {
            let session = WidgetFeedClient.loadSession()
            let feed: WidgetFeedEnvelope?
            if let session {
                feed = await WidgetFeedClient.fetchFeed(session: session)
            } else {
                feed = nil
            }

            let entry = PopupHubWidgetEntry(date: Date(), session: session, feed: feed, isPlaceholder: false)
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
            completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
        }
    }
}

struct PopupHubWidget: Widget {
    let kind: String = "PopupHubWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PopupHubWidgetProvider()) { entry in
            PopupHubWidgetEntryView(entry: entry)
                .containerBackground(for: .widget) {
                    WidgetBackground(theme: entry.feed?.summary?.theme ?? "market_hours")
                }
        }
        .configurationDisplayName("Popup Hub")
        .description("Markets, funds, applications, and notifications at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct WidgetBackground: View {
    let theme: String

    var body: some View {
        switch theme {
        case "evening":
            LinearGradient(colors: [Color(red: 0.12, green: 0.14, blue: 0.22), Color(red: 0.2, green: 0.18, blue: 0.28)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case "morning":
            LinearGradient(colors: [Color(red: 0.95, green: 0.92, blue: 0.86), Color(red: 0.88, green: 0.94, blue: 0.98)], startPoint: .top, endPoint: .bottom)
        default:
            LinearGradient(colors: [Color(red: 0.98, green: 0.97, blue: 0.96), Color(red: 0.92, green: 0.98, blue: 0.94)], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }
}

struct WidgetBrandHeader: View {
    var compact: Bool = false

    var body: some View {
        HStack(spacing: compact ? 6 : 8) {
            Image("BrandLogo")
                .resizable()
                .scaledToFit()
                .frame(width: compact ? 18 : 22, height: compact ? 18 : 22)
            Text("Popup Hub")
                .font(compact ? .caption.bold() : .headline)
                .foregroundStyle(Color(red: 0.176, green: 0.353, blue: 0.153))
        }
    }
}

struct PopupHubWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: PopupHubWidgetEntry

    var body: some View {
        if entry.session == nil {
            SignedOutWidgetView()
        } else if let feed = entry.feed {
            switch family {
            case .systemSmall:
                SmallWidgetView(feed: feed)
            case .systemMedium:
                MediumWidgetView(feed: feed)
            default:
                LargeWidgetView(feed: feed)
            }
        } else {
            LoadingWidgetView()
        }
    }
}

struct SignedOutWidgetView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetBrandHeader()
            Text("Sign in to see your markets and updates.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(URL(string: "https://popuphub.ca/login"))
    }
}

struct LoadingWidgetView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetBrandHeader()
            Text("Couldn't load updates")
                .font(.caption)
                .foregroundStyle(.secondary)
            ProgressView()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(URL(string: "https://popuphub.ca/discover"))
    }
}

struct SmallWidgetView: View {
    let feed: WidgetFeedEnvelope

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                WidgetBrandHeader(compact: true)
                Spacer()
                if (feed.unreadNotifications ?? feed.summary?.unread ?? 0) > 0 {
                    Text("\(feed.unreadNotifications ?? feed.summary?.unread ?? 0)")
                        .font(.caption2.bold())
                        .padding(4)
                        .background(Circle().fill(Color.orange.opacity(0.85)))
                        .foregroundStyle(.white)
                }
            }
            Text(feed.summary?.statusLine ?? personaFallback())
                .font(.subheadline.bold())
                .lineLimit(3)
            Spacer(minLength: 0)
        }
        .widgetURL(primaryDeepLink())
    }

    private func personaFallback() -> String {
        switch feed.persona {
        case "vendor": return "Vendor dashboard"
        case "coordinator": return "Command center"
        default: return "Discover markets"
        }
    }

    private func primaryDeepLink() -> URL? {
        switch feed.persona {
        case "vendor":
            return WidgetFeedClient.deepLinkURL(feed.funds?.addFundsDeepLink ?? "/vendor/dashboard")
        case "coordinator":
            return WidgetFeedClient.deepLinkURL(feed.eventPulse?.studioDeepLink ?? "/coordinator")
        default:
            return WidgetFeedClient.deepLinkURL(feed.discoverDeepLink ?? "/discover")
        }
    }
}

struct MediumWidgetView: View {
    let feed: WidgetFeedEnvelope

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                WidgetBrandHeader()
                Spacer()
                Text(feed.summary?.statusLine ?? "")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            switch feed.persona {
            case "vendor":
                VendorMediumContent(feed: feed)
            case "coordinator":
                CoordinatorMediumContent(feed: feed)
            default:
                PatronMediumContent(feed: feed)
            }
        }
        .widgetURL(WidgetFeedClient.deepLinkURL(feed.discoverDeepLink ?? feed.eventPulse?.studioDeepLink ?? "/discover"))
    }
}

struct LargeWidgetView: View {
    let feed: WidgetFeedEnvelope

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            WidgetBrandHeader()
            Text(feed.summary?.statusLine ?? "")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            switch feed.persona {
            case "vendor":
                VendorLargeContent(feed: feed)
            case "coordinator":
                CoordinatorLargeContent(feed: feed)
            default:
                PatronLargeContent(feed: feed)
            }

            if let notifications = feed.notifications, !notifications.isEmpty {
                Divider()
                ForEach(notifications.prefix(3), id: \.id) { note in
                    Link(destination: WidgetFeedClient.deepLinkURL(note.deepLink ?? feed.notificationsDeepLink) ?? URL(string: "https://popuphub.ca/notifications")!) {
                        Text(note.message)
                            .font(.caption)
                            .lineLimit(2)
                    }
                }
            }
        }
    }
}

struct PatronMediumContent: View {
    let feed: WidgetFeedEnvelope

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach((feed.nearbyMarkets ?? []).prefix(2), id: \.id) { market in
                Link(destination: WidgetFeedClient.deepLinkURL(market.deepLink) ?? URL(string: "https://popuphub.ca/discover")!) {
                    HStack {
                        Text(market.name).font(.subheadline.bold()).lineLimit(1)
                        Spacer()
                        Text(market.status).font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
            Link("Open Map", destination: WidgetFeedClient.deepLinkURL(feed.discoverDeepLink) ?? URL(string: "https://popuphub.ca/discover")!)
                .font(.caption.bold())
        }
    }
}

struct PatronLargeContent: View {
    let feed: WidgetFeedEnvelope

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let vendor = feed.vendorOfTheDay {
                Link(destination: WidgetFeedClient.deepLinkURL(vendor.deepLink) ?? URL(string: "https://popuphub.ca/discover")!) {
                    Text("Vendor of the day: \(vendor.businessName)")
                        .font(.caption.bold())
                }
            }
            ForEach((feed.favoriteMarkets ?? feed.nearbyMarkets ?? []).prefix(4), id: \.id) { market in
                Link(destination: WidgetFeedClient.deepLinkURL(market.deepLink) ?? URL(string: "https://popuphub.ca/discover")!) {
                    Text(market.name).font(.caption).lineLimit(1)
                }
            }
        }
    }
}

struct VendorMediumContent: View {
    let feed: WidgetFeedEnvelope

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let funds = feed.funds {
                Text("Balance: $\(String(format: "%.2f", Double(funds.balanceCents) / 100))")
                    .font(.subheadline.bold())
            }
            if let apps = feed.applications {
                Text("\(apps.approvedCount) confirmed · \(apps.paymentDueCount) payment due")
                    .font(.caption)
            }
            Link("Applications", destination: WidgetFeedClient.deepLinkURL(feed.applications?.applicationsDeepLink) ?? URL(string: "https://popuphub.ca/vendor/applications")!)
                .font(.caption.bold())
        }
    }
}

struct VendorLargeContent: View {
    let feed: WidgetFeedEnvelope

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let market = feed.activeMarket {
                Text("Active: \(market.name)").font(.caption.bold())
            }
            Text("Interest today: \(feed.dailyInterestCount ?? 0)").font(.caption)
            if let apps = feed.applications, apps.paymentDueCount > 0 {
                Link("Pay now (\(apps.paymentDueCount))", destination: WidgetFeedClient.deepLinkURL(apps.applicationsDeepLink) ?? URL(string: "https://popuphub.ca/vendor/applications")!)
                    .font(.caption.bold())
            }
        }
    }
}

struct CoordinatorMediumContent: View {
    let feed: WidgetFeedEnvelope

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let pulse = feed.eventPulse {
                Text("\(pulse.activeCount) active · \(pulse.actionRequiredCount) actions")
                    .font(.subheadline.bold())
                Text("\(pulse.pendingApplicationsCount) pending apps")
                    .font(.caption)
                if let checkIn = pulse.checkInDeepLink {
                    Link("Quick check-in", destination: WidgetFeedClient.deepLinkURL(checkIn)!)
                        .font(.caption.bold())
                }
            }
        }
    }
}

struct CoordinatorLargeContent: View {
    let feed: WidgetFeedEnvelope

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let pulse = feed.eventPulse {
                Text("Fees: $\(pulse.boothFeesCollectedCents / 100) collected · $\(pulse.boothFeesOutstandingCents / 100) outstanding")
                    .font(.caption)
                if let progress = pulse.checkInProgress {
                    Text("Check-in: \(progress.checkedIn)/\(progress.total) vendors")
                        .font(.caption.bold())
                }
                if let occupancy = pulse.occupancyPercent {
                    Text("Occupancy: \(occupancy)%").font(.caption)
                }
            }
            ForEach((feed.approvalQueue ?? []).prefix(3), id: \.id) { item in
                Link("\(item.vendorName) · \(item.eventName)", destination: WidgetFeedClient.deepLinkURL(item.deepLink)!)
                    .font(.caption2)
                    .lineLimit(1)
            }
            if let msg = feed.latestVendorMessage {
                Text("\(msg.vendorName): \(msg.snippet)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
    }
}

@main
struct PopupHubWidgetBundle: WidgetBundle {
    var body: some Widget {
        PopupHubWidget()
    }
}
