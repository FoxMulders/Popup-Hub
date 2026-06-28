package ca.popuphub.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import ca.popuphub.app.widget.WidgetRefreshWorker;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);

        PeriodicWorkRequest refreshWork = new PeriodicWorkRequest.Builder(
            WidgetRefreshWorker.class,
            30,
            TimeUnit.MINUTES
        ).build();
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "popup_hub_widget_refresh",
            ExistingPeriodicWorkPolicy.KEEP,
            refreshWork
        );
    }
}
