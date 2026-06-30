'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

export interface RefundExceptionRow {
  id: string
  booth_application_id: string
  square_payment_id: string
  amount_cents: number
  error_message: string
  retry_count: number
}

interface RefundExceptionsPanelProps {
  eventId: string
  exceptions: RefundExceptionRow[]
}

export function RefundExceptionsPanel({ eventId, exceptions }: RefundExceptionsPanelProps) {
  const router = useRouter()
  const [retryingId, setRetryingId] = useState<string | null>(null)

  if (exceptions.length === 0) return null

  async function retry(exceptionId: string) {
    setRetryingId(exceptionId)
    try {
      const res = await fetch(`/api/events/${eventId}/refund-retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exceptionId }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Retry failed')
        return
      }
      toast.success('Refund succeeded')
      router.refresh()
    } catch {
      toast.error('Network error during retry')
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-harvest-200 bg-harvest-50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-harvest-700 font-semibold text-sm">
        <AlertTriangle className="h-4 w-4" />
        {exceptions.length} refund{exceptions.length === 1 ? '' : 's'} need manual retry
      </div>
      <ul className="space-y-2">
        {exceptions.map((ex) => (
          <li
            key={ex.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-harvest-100 bg-white px-3 py-2 text-xs"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground truncate">
                Payment {ex.square_payment_id.slice(0, 12)}… · ${(ex.amount_cents / 100).toFixed(2)}
              </p>
              <p className="text-muted-foreground truncate">{ex.error_message}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1"
              disabled={retryingId === ex.id}
              onClick={() => retry(ex.id)}
            >
              <RefreshCcw className={`h-3 w-3 ${retryingId === ex.id ? 'animate-spin' : ''}`} />
              Retry
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
