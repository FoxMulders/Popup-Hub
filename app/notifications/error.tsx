'use client'

import { useEffect } from 'react'
import { Bell, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Segment-level error boundary for /notifications.
 *
 * The shell rendered by `app/notifications/layout.tsx` (PortalAwareShell →
 * AppNav / VendorShell / ShopperShell) is intentionally kept *outside* this
 * boundary so a render-time fault in the notifications feed only blanks the
 * feed pane instead of replacing the entire chrome with Next's stock
 * "couldn't load" screen.
 *
 * Per Next.js 16's file-conventions/error contract, error boundaries must be
 * Client Components and accept `{ error, unstable_retry }`. `unstable_retry`
 * is the renamed successor to the v15 `reset` prop — invoking it re-renders
 * just this segment without a full page reload.
 */
export default function NotificationsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    // Surface to the browser console + downstream observability.
    // We deliberately don't ship the digest to the user (it's an
    // internal correlation id) but it's useful in the DevTools log.
    console.error('[notifications] segment crashed', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 xl:px-16">
      <div className="mb-10">
        <div className="mb-1.5 flex items-center gap-3">
          <Bell className="h-7 w-7 text-harvest-500" />
          <h1 className="text-4xl font-bold text-foreground">Notifications</h1>
        </div>
      </div>
      <div
        role="alert"
        className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border bg-white px-6 py-10 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            We couldn&rsquo;t load your notifications
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong while fetching your feed. The rest of the
            app is still available — try again, or come back in a moment.
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          onClick={() => unstable_retry()}
        >
          Try again
        </Button>
      </div>
    </div>
  )
}
