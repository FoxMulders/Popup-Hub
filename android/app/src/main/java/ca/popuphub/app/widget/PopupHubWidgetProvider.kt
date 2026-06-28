package ca.popuphub.app.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import ca.popuphub.app.R
import org.json.JSONArray
import org.json.JSONObject

class PopupHubWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (widgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ACTION_REFRESH) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(android.content.ComponentName(context, PopupHubWidgetProvider::class.java))
            onUpdate(context, manager, ids)
            return
        }
        super.onReceive(context, intent)
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
        val views = RemoteViews(context.packageName, R.layout.popup_hub_widget)
        val feed = WidgetFeedClient.fetchFeedJson(context)

        if (feed == null) {
            views.setTextViewText(R.id.widget_title, "Popup Hub")
            views.setTextViewText(R.id.widget_status, "Sign in to see updates")
            views.setTextViewText(R.id.widget_detail, "")
        } else {
            val summary = feed.optJSONObject("summary")
            views.setTextViewText(R.id.widget_title, "Popup Hub")
            views.setTextViewText(R.id.widget_status, summary?.optString("statusLine") ?: "Ready")
            views.setTextViewText(R.id.widget_detail, buildDetailLine(feed))
        }

        val deepLink = resolveDeepLink(feed)
        val openIntent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink))
        openIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        val pending = android.app.PendingIntent.getActivity(
            context,
            widgetId,
            openIntent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_root, pending)

        manager.updateAppWidget(widgetId, views)
    }

    private fun resolveDeepLink(feed: JSONObject?): String {
        if (feed == null) return "https://popuphub.ca/login"
        return when (feed.optString("persona")) {
            "vendor" -> feed.optJSONObject("funds")?.optString("addFundsDeepLink")?.let { "https://popuphub.ca$it" }
                ?: "https://popuphub.ca/vendor/dashboard"
            "coordinator" -> feed.optJSONObject("eventPulse")?.optString("studioDeepLink")?.let {
                if (it.startsWith("http")) it else "https://popuphub.ca$it"
            } ?: "https://popuphub.ca/coordinator"
            else -> "https://popuphub.ca/discover"
        }
    }

    private fun buildDetailLine(feed: JSONObject): String {
        return when (feed.optString("persona")) {
            "vendor" -> {
                val apps = feed.optJSONObject("applications")
                val funds = feed.optJSONObject("funds")
                val balance = funds?.optInt("balanceCents", 0) ?: 0
                "Balance $${"%.2f".format(balance / 100.0)} · ${apps?.optInt("paymentDueCount", 0) ?: 0} due"
            }
            "coordinator" -> {
                val pulse = feed.optJSONObject("eventPulse")
                "${pulse?.optInt("activeCount", 0) ?: 0} active · ${pulse?.optInt("actionRequiredCount", 0) ?: 0} actions"
            }
            else -> {
                val markets = feed.optJSONArray("nearbyMarkets") ?: JSONArray()
                "${markets.length()} nearby markets"
            }
        }
    }

    companion object {
        const val ACTION_REFRESH = "ca.popuphub.app.widget.REFRESH"
    }
}
