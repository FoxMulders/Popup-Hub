package ca.popuphub.app.widget

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class WidgetRefreshWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val intent = android.content.Intent(applicationContext, PopupHubWidgetProvider::class.java)
        intent.action = PopupHubWidgetProvider.ACTION_REFRESH
        applicationContext.sendBroadcast(intent)
        return Result.success()
    }
}
