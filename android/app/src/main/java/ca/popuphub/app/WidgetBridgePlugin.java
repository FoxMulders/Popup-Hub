package ca.popuphub.app;

import android.content.Context;
import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import ca.popuphub.app.widget.PopupHubWidgetProvider;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    public static final String PREFS_NAME = "popup_hub_widget";
    public static final String TOKEN_KEY = "widget_auth_token";
    public static final String SNAPSHOT_KEY = "widget_snapshot_json";

    @PluginMethod
    public void save(PluginCall call) {
        String token = call.getString("token");
        String snapshotJson = call.getString("snapshotJson");
        if (token == null || snapshotJson == null) {
            call.reject("token and snapshotJson required");
            return;
        }

        Context context = getContext();
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(TOKEN_KEY, token)
            .putString(SNAPSHOT_KEY, snapshotJson)
            .apply();

        Intent updateIntent = new Intent(context, PopupHubWidgetProvider.class);
        updateIntent.setAction(PopupHubWidgetProvider.ACTION_REFRESH);
        context.sendBroadcast(updateIntent);

        call.resolve(new JSObject());
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Context context = getContext();
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(TOKEN_KEY)
            .remove(SNAPSHOT_KEY)
            .apply();

        Intent updateIntent = new Intent(context, PopupHubWidgetProvider.class);
        updateIntent.setAction(PopupHubWidgetProvider.ACTION_REFRESH);
        context.sendBroadcast(updateIntent);

        call.resolve(new JSObject());
    }
}
