'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle2, Loader2, Timer } from 'lucide-react'
import { formatCents } from '@/lib/square/client'
import { formatEtransferExpiryCountdown } from '@/lib/applications/etransfer-reference'
import {
  formatPaymentDueAtDisplay,
  paymentDueCountdownLabel,
} from '@/lib/applications/payment-deadline'
import type { BoothApplication } from '@/types/database'

export type PendingEtransferApplication = BoothApplication & {
  vendor?: { full_name: string | null; email: string | null } | null
  event?: { id: string; name: string } | null
  category?: { name: string } | null
  booth_price_cents?: number
}

interface PendingEtransferPanelProps {
  applications: PendingEtransferApplication[]
}

export function PendingEtransferPanel({ applications: initial }: PendingEtransferPanelProps) {
  const router = useRouter()
  const [applications, setApplications] = useState(initial)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function confirmEtransfer(applicationId: string) {
    setPendingId(applicationId)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/coordinator/confirm-etransfer/${applicationId}`, {
          method: 'POST',
        })
        const data = (await res.json()) as { error?: string; revenueAddedCents?: number }
        if (!res.ok) {
          toast.error(data.error ?? 'Could not confirm e-transfer')
          return
        }

        setApplications((rows) => rows.filter((row) => row.id !== applicationId))
        const added =
          typeof data.revenueAddedCents === 'number'
            ? formatCents(data.revenueAddedCents)
            : null
        toast.success(
          added
            ? `E-transfer confirmed · ${added} added to booth revenue`
            : 'E-transfer confirmed — vendor notified'
        )
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
        <h3 className="font-heading font-semibold">Awaiting funds verification</h3>
        <p className="text-sm text-muted-foreground">
          Vendors who chose Interac e-Transfer stay in <span className="font-semibold">Pending</span>{' '}
          until you click <span className="font-semibold">Mark as Paid &amp; Approve</span> —
          that single action settles the balance and moves them into the Approved pool.
        </p>
      </div>

      <ul className="space-y-3">
        {applications.map((app) => {
          const vendor = Array.isArray(app.vendor) ? app.vendor[0] : app.vendor
          const event = Array.isArray(app.event) ? app.event[0] : app.event
          const category = Array.isArray(app.category) ? app.category[0] : app.category
          const priceCents = app.booth_price_cents ?? 0
          const countdown = app.payment_due_at
            ? paymentDueCountdownLabel(app.payment_due_at)
            : app.etransfer_expires_at
              ? formatEtransferExpiryCountdown(app.etransfer_expires_at)
              : null
          const dueDisplay = app.payment_due_at
            ? formatPaymentDueAtDisplay(app.payment_due_at)
            : null
          const busy = isPending && pendingId === app.id

          return (
            <li
              key={app.id}
              className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50/80 to-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-foreground">
                    {vendor?.full_name ?? 'Vendor'}
                  </p>
                  <p className="text-xs text-muted-foreground">{vendor?.email}</p>
                  <p className="text-sm text-foreground">
                    {event?.name ?? 'Event'}
                    {category?.name ? (
                      <span className="text-muted-foreground"> · {category.name}</span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      E-Transfer
                    </Badge>
                    {app.etransfer_reference_code ? (
                      <Badge className="bg-sky-100 text-sky-950 text-[10px] font-mono">
                        Ref {app.etransfer_reference_code}
                      </Badge>
                    ) : null}
                    {priceCents > 0 ? (
                      <span className="text-xs font-semibold text-foreground">
                        {formatCents(priceCents)}
                      </span>
                    ) : null}
                  </div>
                  {countdown ? (
                    <p className="inline-flex items-center gap-1 text-[11px] font-medium text-terracotta-700">
                      <Timer className="h-3 w-3" aria-hidden />
                      {countdown}
                      {dueDisplay ? ` · due ${dueDisplay}` : null}
                    </p>
                  ) : null}
                  <p className="text-[10px] text-muted-foreground">
                    Applied{' '}
                    {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 bg-sky-700 hover:bg-sky-800 text-white shadow-sm"
                  disabled={busy}
                  onClick={() => confirmEtransfer(app.id)}
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {app.status === 'approved' || app.status === 'pending_insurance'
                    ? 'Confirm E-Transfer'
                    : 'Mark as Paid & Approve'}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
