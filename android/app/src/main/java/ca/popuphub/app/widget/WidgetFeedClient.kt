package ca.popuphub.app.widget

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class WidgetSession(
    val token: String,
    val apiBaseUrl: String,
    val persona: String
)

object WidgetFeedClient {
    private const val PREFS = "popup_hub_widget"
    private const val TOKEN_KEY = "widget_auth_token"
    private const val SNAPSHOT_KEY = "widget_snapshot_json"
    private const val DEFAULT_API = "https://popuphub.ca"

    fun loadSession(context: Context): WidgetSession? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val token = prefs.getString(TOKEN_KEY, null) ?: return null
        val snapshotJson = prefs.getString(SNAPSHOT_KEY, null) ?: return null
        return try {
            val json = JSONObject(snapshotJson)
            WidgetSession(
                token = token,
                apiBaseUrl = json.optString("apiBaseUrl", DEFAULT_API),
                persona = json.optString("persona", "patron")
            )
        } catch (_: Exception) {
            null
        }
    }

    fun fetchFeedJson(context: Context): JSONObject? {
        val session = loadSession(context) ?: return null
        val base = session.apiBaseUrl.ifBlank { DEFAULT_API }
        val connection = (URL("$base/api/widget/feed").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            setRequestProperty("Authorization", "Bearer ${session.token}")
            connectTimeout = 15_000
            readTimeout = 15_000
        }
        return try {
            if (connection.responseCode !in 200..299) return null
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            JSONObject(body)
        } catch (_: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    fun postAction(context: Context, action: String, extras: Map<String, String> = emptyMap()): Boolean {
        val session = loadSession(context) ?: return false
        val base = session.apiBaseUrl.ifBlank { DEFAULT_API }
        val payload = JSONObject()
        payload.put("action", action)
        for ((key, value) in extras) payload.put(key, value)

        val connection = (URL("$base/api/widget/action").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Authorization", "Bearer ${session.token}")
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
            connectTimeout = 15_000
            readTimeout = 15_000
        }
        return try {
            connection.outputStream.use { it.write(payload.toString().toByteArray()) }
            connection.responseCode in 200..299
        } catch (_: Exception) {
            false
        } finally {
            connection.disconnect()
        }
    }
}
