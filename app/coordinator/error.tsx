'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { COORDINATOR_MARKETS_PATH } from '@/lib/coordinator/coordinator-routes'
import { cn } from '@/lib/utils'

export default function CoordinatorError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('[coordinator] segment error', {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          We couldn&rsquo;t load this coordinator page
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try again, or return to your markets list. If this keeps happening, one market
          record may have incomplete data — we can still load the rest after a refresh.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={() => unstable_retry()}>
          Reload
        </Button>
        <Link
          href={COORDINATOR_MARKETS_PATH}
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          Your markets
        </Link>
      </div>
    </div>
  )
}
