'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { AlertCircle, Clock, CreditCard, Loader2, Timer } from 'lucide-react'
import { formatCents } from '@/lib/square/client'
import {
  formatPaymentDueAtDisplay,
  paymentDueCountdownLabel,
} from '@/lib/applications/payment-deadline'
import type { OutstandingPaymentApplication } from '@/lib/applications/fetch-event-outstanding-payments'

interface OutstandingPaymentsPanelProps {
  applications: OutstandingPaymentApplication[]
}

function isOverdue(paymentDueAt: string | null): boolean {
  if (!paymentDueAt) return false
  return new Date(paymentDueAt).getTime() <= Date.now()
}

export function OutstandingPaymentsPanel({ applications: initial }: OutstandingPaymentsPanelProps) {
  const router = useRouter()
  const [applications, setApplications] = useState(initial)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function extendDeadline(applicationId: string, hours: 24 | 48) {
    setPendingId(applicationId)
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/coordinator/applications/${applicationId}/extend-payment-deadline`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hours }),
          }
        )
        const data = (await res.json()) as { error?: string; payment_due_at?: string }
        if (!res.ok) {
          toast.error(data.error ?? 'Could not extend deadline')
          return
        }
        setApplications((rows) =>
          rows.map((row) =>
            row.id === applicationId
              ? { ...row, payment_due_at: data.payment_due_at ?? row.payment_due_at }
              : row
          )
        )
        toast.success(`Payment deadline extended ${hours} hours`)
        router.refresh()
      } finally {
        setPendingId(null)
      }
    })
  }

  if (applications.length === 0) {
    return null
  }

  return (
    <div className="market-panel space-y-4 p-5">
      <div>
        <h3 className="font-heading font-semibold inline-flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-harvest-700" aria-hidden />
          Awaiting card payment
        </h3>
        <p className="text-sm text-muted-foreground">
          Approved vendors who still need to complete Square or Stripe checkout. Unpaid booths are
          auto-released when the payment deadline passes — extend if you are chasing manually.
        </p>
      </div>

      <ul className="space-y-3">
        {applications.map((app) => {
          const vendor = Array.isArray(app.vendor) ? app.vendor[0] : app.vendor
          const category = Array.isArray(app.category) ? app.category[0] : app.category
          const overdue = isOverdue(app.payment_due_at)
          const busy = isPending && pendingId === app.id

          return (
            <li
              key={app.id}
              className={`rounded-xl border p-4 ${
                overdue
                  ? 'border-terracotta-300 bg-gradient-to-br from-terracotta-50/80 to-white'
                  : 'border-harvest-200 bg-gradient-to-br from-harvest-50/60 to-white'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-foreground">{vendor?.full_name ?? 'Vendor'}</p>
                  <p className="text-xs text-muted-foreground">{vendor?.email}</p>
                  {category?.name ? (
                    <p className="text-sm text-muted-foreground">{category.name}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      Card checkout
                    </Badge>
                    {app.booth_price_cents > 0 ? (
                      <span className="text-xs font-semibold">{formatCents(app.booth_price_cents)}</span>
                    ) : null}
                    {overdue ? (
                      <Badge className="bg-terracotta-100 text-terracotta-900 text-[10px]">
                        <AlertCircle className="mr-1 h-3 w-3" aria-hidden />
                        Overdue
                      </Badge>
                    ) : null}
                  </div>
                  {app.payment_due_at ? (
                    <p className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground">
                      <Timer className="h-3 w-3 text-harvest-700" aria-hidden />
                      {paymentDueCountdownLabel(app.payment_due_at)} · Pay by{' '}
                      {formatPaymentDueAtDisplay(app.payment_due_at)}
                    </p>
                  ) : (
                    <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden />
                      Payment deadline pending
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => extendDeadline(app.id, 24)}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '+24h'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => extendDeadline(app.id, 48)}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '+48h'}
                  </Button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
