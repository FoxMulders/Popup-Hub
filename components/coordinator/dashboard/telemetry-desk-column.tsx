'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, CreditCard, DollarSign, Loader2, RefreshCw, TrendingUp } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { needsOfflineCoordinatorReview } from '@/lib/applications/payment-fields'
import type { PaymentMethod } from '@/types/database'
import { useMarketManagement, formatCadCurrency } from './market-management-context'
import { BOOTH_STATUS_THEME } from '@/lib/coordinator/booth-placement-status'

export function TelemetryDeskColumn() {
  const router = useRouter()
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const {
    telemetry,
    totalRevenueCents,
    selectedBoothId,
    boothStatusByObjectId,
    floorPlanStore,
    toggleVipHold,
    approvedPool,
    vipHoldApplicationIds,
  } = useMarketManagement()

  const selectedBooth =
    selectedBoothId && floorPlanStore
      ? floorPlanStore.doc.objects.find((o) => o.id === selectedBoothId && o.kind === 'booth')
      : null

  const selectedStatus = selectedBoothId
    ? boothStatusByObjectId.get(selectedBoothId)
    : undefined
  const statusTheme = selectedStatus ? BOOTH_STATUS_THEME[selectedStatus] : null

  const selectedVendorId =
    selectedBooth && selectedBooth.kind === 'booth'
      ? (selectedBooth as { vendorId?: string | null }).vendorId
      : null
  const selectedApp = selectedVendorId
    ? approvedPool.find((a) => a.vendor_id === selectedVendorId)
    : null

  const offlinePending =
    selectedApp != null &&
    needsOfflineCoordinatorReview({
      payment_method: selectedApp.payment_method as PaymentMethod | null,
      application_payment_status: selectedApp.application_payment_status as
        | 'PENDING_REVIEW'
        | 'COMPLETED'
        | 'EXPIRED'
        | null,
      status: selectedApp.status,
    })

  const fillRate =
    telemetry.totalBooths > 0
      ? Math.round((telemetry.assignedBooths / telemetry.totalBooths) * 100)
      : 0

  function markOfflinePaid(applicationId: string) {
    setMarkingPaidId(applicationId)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/coordinator/confirm-etransfer/${applicationId}`, {
          method: 'POST',
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) {
          toast.error(data.error ?? 'Could not mark payment as paid')
          return
        }
        toast.success('Payment marked as paid')
        router.refresh()
      } finally {
        setMarkingPaidId(null)
      }
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="market-panel-header shrink-0 rounded-none border-0 border-b border-stone-200/80 bg-gradient-to-l from-card via-card to-emerald-50/30 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90">
            Telemetry desk
          </p>
          <h2 className="market-panel-title text-base">Payments</h2>
        </div>
        <span
          className={
            telemetry.squareConnected || telemetry.stripeConnected
              ? 'inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-900'
              : 'inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900'
          }
        >
          <CreditCard className="h-3 w-3" aria-hidden />
          {telemetry.squareConnected || telemetry.stripeConnected ? 'Connected' : 'Setup needed'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <motion.div
          layout
          className="grid grid-cols-2 gap-2"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <TelemetryStat label="Fill rate" value={`${fillRate}%`} icon={TrendingUp} />
          <TelemetryStat
            label="Collected"
            value={formatCadCurrency(telemetry.collectedRevenueCents)}
            icon={DollarSign}
          />
          <TelemetryStat label="Paid booths" value={String(telemetry.paidBooths)} />
          <TelemetryStat label="VIP holds" value={String(telemetry.vipHoldBooths)} />
          <TelemetryStat label="Open booths" value={String(telemetry.unassignedBooths)} />
          <TelemetryStat
            label="Pending"
            value={formatCadCurrency(telemetry.pendingRevenueCents)}
          />
        </motion.div>

        <div className="mt-4 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Lifetime organizer revenue
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-forest">
            {formatCadCurrency(totalRevenueCents)}
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Booth status legend
          </p>
          {(Object.keys(BOOTH_STATUS_THEME) as Array<keyof typeof BOOTH_STATUS_THEME>).map(
            (key) => {
              const theme = BOOTH_STATUS_THEME[key]
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-lg border border-stone-200 px-2 py-1.5 text-xs"
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded border"
                    style={{ background: theme.fill, borderColor: theme.stroke }}
                    aria-hidden
                  />
                  <span className="font-medium">{theme.label}</span>
                </div>
              )
            }
          )}
        </div>

        {selectedBooth && statusTheme ? (
          <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-xl border-2 border-emerald-200/80 bg-emerald-50/40 p-3"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
              Selected booth
            </p>
            <p className="mt-1 text-sm font-semibold">
              {(selectedBooth as { label?: string }).label || 'Booth'}
            </p>
            <p className="text-xs text-muted-foreground">{statusTheme.label}</p>
            {selectedApp ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {offlinePending ? (
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs bg-sky-700 hover:bg-sky-800 text-white"
                    disabled={isPending && markingPaidId === selectedApp.id}
                    onClick={() => markOfflinePaid(selectedApp.id)}
                  >
                    {isPending && markingPaidId === selectedApp.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Mark applicant as paid
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant={vipHoldApplicationIds.has(selectedApp.id) ? 'default' : 'outline'}
                  className="text-xs"
                  onClick={() => toggleVipHold(selectedApp.id)}
                >
                  {vipHoldApplicationIds.has(selectedApp.id) ? 'Release VIP hold' : 'Mark VIP hold'}
                </Button>
              </div>
            ) : null}
          </motion.div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Select a booth to inspect its vendor&apos;s payment status. Mark applicants as paid from
            the Applications board or here when offline payment is pending.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <Link href="/coordinator/payment-methods">
            <Button size="sm" className="w-full gap-1.5">
              <CreditCard className="h-4 w-4" aria-hidden />
              Payment methods
            </Button>
          </Link>
          {telemetry.squareConnected || telemetry.stripeConnected ? (
            <Button size="sm" variant="outline" className="w-full gap-1.5" disabled>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Payout sync active
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function TelemetryStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: typeof DollarSign
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
        {label}
      </div>
      <p className="mt-0.5 font-heading text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
