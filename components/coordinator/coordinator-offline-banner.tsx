'use client'

import { WifiOff, CloudUpload } from 'lucide-react'
import { useCoordinatorOpsSync } from '@/lib/coordinator/use-coordinator-ops-sync'

export function CoordinatorOfflineBanner({ eventId }: { eventId: string }) {
  const { isOnline, pendingCount, syncing } = useCoordinatorOpsSync(eventId)

  if (isOnline && pendingCount === 0) return null

  return (
    <div
      className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
        isOnline
          ? 'border-amber-200 bg-amber-50 text-amber-950'
          : 'border-stone-300 bg-stone-100 text-stone-800'
      }`}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <CloudUpload className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      )}
      <div>
        {!isOnline ? (
          <p className="font-medium">Working offline</p>
        ) : (
          <p className="font-medium">{syncing ? 'Syncing changes…' : 'Pending sync'}</p>
        )}
        <p className="text-xs opacity-90">
          {!isOnline
            ? 'Changes are saved on this device and will sync when you reconnect.'
            : pendingCount > 0
              ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} queued — syncing automatically.`
              : 'All changes synced.'}
        </p>
      </div>
    </div>
  )
}
