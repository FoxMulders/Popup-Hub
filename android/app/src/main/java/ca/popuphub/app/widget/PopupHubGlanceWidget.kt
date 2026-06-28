package ca.popuphub.app.widget

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.provideContent
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import org.json.JSONObject

class PopupHubGlanceWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val feed = WidgetFeedClient.fetchFeedJson(context)
            if (feed == null) {
                Text(text = "Sign in to Popup Hub", style = TextStyle(color = ColorProvider(android.graphics.Color.DKGRAY)))
            } else {
                val summary = feed.optJSONObject("summary")
                val status = summary?.optString("statusLine") ?: "Popup Hub"
                val persona = feed.optString("persona", "patron")
                Text(
                    text = "$status · $persona",
                    style = TextStyle(color = ColorProvider(android.graphics.Color.BLACK))
                )
            }
        }
    }
}
