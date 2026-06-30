'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CheckSquare,
  Square,
  ImageIcon,
} from 'lucide-react'
import { VendorMetricsBadge } from '@/components/coordinator/vendor-metrics-badge'
import { EarlyDepartureDialog } from '@/components/coordinator/early-departure-dialog'
import {
  computeVendorReliabilityScore,
  type VendorReliabilityInputs,
} from '@/lib/vendor-reliability'
import { isApplicationPaid } from '@/lib/applications/payment-fields'
import { CoordinatorOpsSnapshotSeed } from '@/components/coordinator/coordinator-ops-snapshot-seed'
import { commitCoordinatorMutation } from '@/lib/pwa/coordinator-ops-offline'
import type { BoothApplication, PaymentStatus, Profile, VendorPassport } from '@/types/database'

type OpsApplication = Omit<BoothApplication, 'vendor' | 'passport' | 'category'> & {
  vendor: Profile
  passport: VendorPassport | null
  category: { name: string } | null
}

type LoadInStatus = 'on_time' | 'late' | 'missed'

interface MarketOpsPanelProps {
  eventId: string
  eventName?: string | null
  applications: OpsApplication[]
  raffleDonationRequirement?: string | null
}

const LOAD_IN_STATUSES: { value: LoadInStatus; label: string; className: string }[] = [
  { value: 'on_time', label: 'On-Time', className: 'bg-sage-100 text-sage-800 border-sage-300' },
  { value: 'late', label: 'Late', className: 'bg-harvest-100 text-harvest-800 border-harvest-400' },
  { value: 'missed', label: 'Missed', className: 'bg-terracotta-50 text-terracotta-800 border-terracotta-200' },
]

function boothTypeBadge(type: string | null | undefined) {
  if (!type) return null
  const map: Record<string, string> = {
    wall: 'bg-harvest-100 text-harvest-700 border border-harvest-200',
    power: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    inside: 'bg-sage-50 text-sage-800 border border-sage-200',
    any: 'bg-canvas text-muted-foreground border border-stone-200',
  }
  return (
    <span
      className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize ${map[type] ?? 'bg-canvas text-muted-foreground'}`}
    >
      {type}
    </span>
  )
}

export function MarketOpsPanel({
  eventId,
  eventName,
  applications: initial,
  raffleDonationRequirement,
}: MarketOpsPanelProps) {
  const supabase = createClient()
  const [apps, setApps] = useState<OpsApplication[]>(initial)

  useEffect(() => {
    setApps(initial)
  }, [initial])
  const [vendorMetrics, setVendorMetrics] = useState<Record<string, VendorReliabilityInputs>>(() =>
    Object.fromEntries(
      initial.map((a) => [
        a.vendor_id,
        {
          reliability_score: a.vendor?.reliability_score,
          no_show_count: a.vendor?.no_show_count,
          left_early_count: a.vendor?.left_early_count,
          late_arrival_count: a.vendor?.late_arrival_count,
          poor_cleanup_strike_count: a.vendor?.poor_cleanup_strike_count,
        },
      ])
    )
  )
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [earlyDepartureApp, setEarlyDepartureApp] = useState<OpsApplication | null>(null)

  function setBusyFor(id: string, value: boolean) {
    setBusy((prev) => ({ ...prev, [id]: value }))
  }

  function patchApp(id: string, patch: Partial<OpsApplication>) {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  async function togglePayment(app: OpsApplication) {
    setBusyFor(app.id, true)
    const currentlyPaid = isApplicationPaid(app)
    const nextPaid = !currentlyPaid
    const updates: Partial<OpsApplication> =
      app.payment_method === 'ETRANSFER'
        ? {
            application_payment_status: nextPaid ? 'COMPLETED' : 'PENDING_REVIEW',
            payment_status: (nextPaid ? 'paid' : 'pending') as PaymentStatus,
          }
        : { payment_status: (nextPaid ? 'paid' : 'unpaid') as PaymentStatus }

    patchApp(app.id, updates)
    const { queued, synced } = await commitCoordinatorMutation(eventId, 'payment_status', {
      applicationId: app.id,
      updates,
    })

    if (!synced && queued) {
      toast.message('Saved offline — will sync when connected')
    } else if (!synced) {
      const { error } = await supabase
        .from('booth_applications')
        .update(updates)
        .eq('id', app.id)
        .eq('event_id', eventId)
      if (error) {
        patchApp(app.id, {
          payment_status: app.payment_status,
          application_payment_status: app.application_payment_status,
        })
        toast.error('Failed to update payment status')
      } else {
        toast.success(nextPaid ? 'Marked as paid ✓' : 'Marked as unpaid')
      }
    } else {
      toast.success(nextPaid ? 'Marked as paid ✓' : 'Marked as unpaid')
    }
    setBusyFor(app.id, false)
  }

  async function updateLoadInStatus(app: OpsApplication, status: LoadInStatus) {
    const next = app.load_in_status === status ? null : status
    patchApp(app.id, { load_in_status: next })

    let reliabilityPatch: Record<string, unknown> | undefined
    if (next === 'late' || next === 'missed') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('late_arrival_count, no_show_count, left_early_count, poor_cleanup_strike_count')
        .eq('id', app.vendor_id)
        .single()
      if (profile) {
        const lateCount =
          next === 'late' ? (profile.late_arrival_count ?? 0) + 1 : profile.late_arrival_count ?? 0
        const metrics: VendorReliabilityInputs = {
          no_show_count: profile.no_show_count,
          left_early_count: profile.left_early_count,
          late_arrival_count: lateCount,
          poor_cleanup_strike_count: profile.poor_cleanup_strike_count,
        }
        const newScore = computeVendorReliabilityScore(metrics)
        reliabilityPatch = { late_arrival_count: lateCount, reliability_score: newScore }
        setVendorMetrics((prev) => ({
          ...prev,
          [app.vendor_id]: { ...metrics, reliability_score: newScore },
        }))
      }
    }

    const { queued, synced } = await commitCoordinatorMutation(eventId, 'load_in_status', {
      applicationId: app.id,
      load_in_status: next,
      vendorId: app.vendor_id,
      reliabilityPatch,
    })

    if (!synced && queued) {
      toast.message('Saved offline — will sync when connected')
      setBusyFor(app.id, false)
      return
    }
    if (!synced) {
      const { error } = await supabase
        .from('booth_applications')
        .update({ load_in_status: next })
        .eq('id', app.id)
        .eq('event_id', eventId)
      if (error) {
        patchApp(app.id, { load_in_status: app.load_in_status })
        toast.error('Failed to update load-in status')
        setBusyFor(app.id, false)
        return
      }
      if (reliabilityPatch) {
        await supabase.from('profiles').update(reliabilityPatch).eq('id', app.vendor_id)
      }
    }
    setBusyFor(app.id, false)
  }

  async function toggleRaffle(app: OpsApplication) {
    setBusyFor(app.id + '-raffle', true)
    const next = !app.raffle_donation_received
    patchApp(app.id, { raffle_donation_received: next })
    const { queued, synced } = await commitCoordinatorMutation(eventId, 'raffle_donation', {
      applicationId: app.id,
      raffle_donation_received: next,
    })
    if (!synced && queued) {
      toast.message('Saved offline — will sync when connected')
    } else if (!synced) {
      const { error } = await supabase
        .from('booth_applications')
        .update({ raffle_donation_received: next })
        .eq('id', app.id)
        .eq('event_id', eventId)
      if (error) {
        patchApp(app.id, { raffle_donation_received: app.raffle_donation_received })
        toast.error('Failed to update raffle donation')
      }
    }
    setBusyFor(app.id + '-raffle', false)
  }

  async function confirmEarlyDeparture(notes: string) {
    const app = earlyDepartureApp
    if (!app || app.left_early) return

    setBusyFor(app.id + '-early', true)
    patchApp(app.id, { left_early: true, early_departure_notes: notes || null })

    let reliabilityPatch: Record<string, unknown> | undefined
    const { data: profile } = await supabase
      .from('profiles')
      .select('left_early_count, no_show_count, late_arrival_count, poor_cleanup_strike_count')
      .eq('id', app.vendor_id)
      .single()

    if (profile) {
      const newLeftEarlyCount = (profile.left_early_count ?? 0) + 1
      const metrics: VendorReliabilityInputs = {
        no_show_count: profile.no_show_count,
        left_early_count: newLeftEarlyCount,
        late_arrival_count: profile.late_arrival_count,
        poor_cleanup_strike_count: profile.poor_cleanup_strike_count,
      }
      const newScore = computeVendorReliabilityScore(metrics)
      reliabilityPatch = { left_early_count: newLeftEarlyCount, reliability_score: newScore }
      setVendorMetrics((prev) => ({
        ...prev,
        [app.vendor_id]: { ...metrics, reliability_score: newScore },
      }))
    }

    const { queued, synced } = await commitCoordinatorMutation(eventId, 'early_exit', {
      applicationId: app.id,
      early_departure_notes: notes || null,
      vendorId: app.vendor_id,
      reliabilityPatch,
    })

    if (!synced && queued) {
      toast.message('Saved offline — will sync when connected')
    } else if (!synced) {
      const { error } = await supabase
        .from('booth_applications')
        .update({ left_early: true, early_departure_notes: notes || null })
        .eq('id', app.id)
        .eq('event_id', eventId)
      if (error) {
        patchApp(app.id, {
          left_early: app.left_early,
          early_departure_notes: app.early_departure_notes,
        })
        toast.error('Failed to update')
        setBusyFor(app.id + '-early', false)
        setEarlyDepartureApp(null)
        return
      }
      if (reliabilityPatch) {
        await supabase.from('profiles').update(reliabilityPatch).eq('id', app.vendor_id)
      }
    }

    toast.warning('Vendor marked as left early')
    setBusyFor(app.id + '-early', false)
    setEarlyDepartureApp(null)
  }

  const checkedInCount = apps.filter((a) => a.checked_in).length
  const paidCount = apps.filter((a) => isApplicationPaid(a)).length
  const clearedCount = apps.filter((a) => a.booth_cleared).length

  return (
    <div className="space-y-4">
      <CoordinatorOpsSnapshotSeed
        eventId={eventId}
        eventName={eventName}
        applications={apps}
        onHydrate={setApps}
      />
      {raffleDonationRequirement && (
        <div className="market-card border-harvest-200/80 bg-harvest-50/50 px-4 py-3 text-sm text-harvest-800">
          <p className="font-semibold text-harvest-800">Raffle donation required</p>
          <p className="mt-1 text-harvest-700/90">{raffleDonationRequirement}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Checked In', value: `${checkedInCount}/${apps.length}`, color: 'text-sage-700' },
          { label: 'Paid (Square)', value: `${paidCount}/${apps.length}`, color: 'text-harvest-700' },
          { label: 'Booths Cleared', value: `${clearedCount}/${apps.length}`, color: 'text-terracotta-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="market-card p-3 text-center">
            <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="market-table-wrap scroll-touch-x">
        <table className="w-full text-sm border-collapse min-w-[960px]">
          <thead>
            <tr className="border-b-2 border-stone-200 bg-canvas">
              <th className="px-3 py-3 text-left text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wider">Booth</th>
              <th className="px-3 py-3 text-left text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wider">Vendor</th>
              <th className="px-3 py-3 text-left text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="px-3 py-3 text-left text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wider">Payment</th>
              <th className="px-3 py-3 text-left text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wider">Load-In</th>
              <th className="px-3 py-3 text-left text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wider">Check-In</th>
              <th className="px-3 py-3 text-left text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wider">Raffle</th>
              <th className="px-3 py-3 text-left text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wider">Early Exit</th>
              <th className="px-3 py-3 text-left text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wider">Cleared</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sage-100/80">
            {apps.map((app) => {
              const displayName = app.passport?.business_name ?? app.vendor.full_name
              const metrics = vendorMetrics[app.vendor_id] ?? app.vendor
              const isRowBusy = busy[app.id]

              return (
                <tr
                  key={app.id}
                  className={
                    app.left_early
                      ? 'bg-terracotta-50/50'
                      : app.booth_cleared
                        ? 'bg-sage-50/40'
                        : 'hover:bg-sage-50/30'
                  }
                >
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {app.booth_number != null ? (
                      <div className="h-8 w-8 rounded-lg bg-harvest-100 text-harvest-700 border border-harvest-200 flex items-center justify-center text-xs font-bold">
                        {app.booth_number}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50 text-xs">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5">
                    <div className="flex flex-col min-w-[140px]">
                      <span className="font-medium text-foreground leading-tight">{displayName}</span>
                      {app.category?.name && (
                        <Badge variant="outline" className="mt-1 w-fit text-[10px] py-0 h-5 border-sage-200">
                          {app.category.name}
                        </Badge>
                      )}
                      <div className="mt-1">
                        <VendorMetricsBadge vendor={metrics} compact />
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap">{boothTypeBadge(app.requested_booth_type)}</td>

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => togglePayment(app)}
                      disabled={isRowBusy}
                      className={`min-h-11 rounded-full border px-3 py-2 text-xs font-medium transition-all duration-200 active:translate-y-0.5 ${
                        isApplicationPaid(app)
                          ? 'bg-sage-100 text-sage-800 border-sage-300 hover:bg-sage-200'
                          : 'bg-harvest-50 text-harvest-800 border-harvest-200 hover:bg-harvest-100'
                      }`}
                    >
                      {isApplicationPaid(app)
                        ? app.payment_method === 'ETRANSFER'
                          ? 'E-transfer ✓'
                          : 'Paid ✓'
                        : app.payment_method === 'ETRANSFER'
                          ? 'E-transfer pending'
                          : 'Unpaid'}
                    </button>
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {LOAD_IN_STATUSES.map(({ value, label, className }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateLoadInStatus(app, value)}
                          className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-200 active:translate-y-0.5 ${
                            app.load_in_status === value
                              ? className
                              : 'border-stone-200 text-muted-foreground opacity-70 hover:opacity-100 hover:bg-canvas'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                      {app.checked_in ? (
                        <CheckCircle2 className="h-5 w-5 text-sage-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-terracotta-400" />
                      )}
                      {app.arrived_at && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(app.arrived_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleRaffle(app)}
                      disabled={busy[app.id + '-raffle']}
                      className="flex flex-col items-start gap-0.5 text-left text-xs"
                    >
                      <span className="flex items-center gap-1">
                        {app.raffle_donation_received ? (
                          <CheckSquare className="h-4 w-4 text-sage-600" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground/40" />
                        )}
                        <span
                          className={
                            app.raffle_donation_received ? 'text-sage-700 font-medium' : 'text-muted-foreground'
                          }
                        >
                          {app.raffle_donation_received ? 'Received' : 'Pending'}
                        </span>
                      </span>
                      {!app.raffle_donation_received && raffleDonationRequirement && (
                        <span className="text-[9px] text-harvest-700/80 max-w-[140px] line-clamp-2">
                          {raffleDonationRequirement}
                        </span>
                      )}
                    </button>
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {app.left_early ? (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-terracotta-50 border border-terracotta-200 px-2 py-0.5 text-xs font-medium text-terracotta-800">
                          <AlertTriangle className="h-3 w-3" />
                          Left Early
                        </span>
                        {app.early_departure_notes && (
                          <p className="text-[9px] text-muted-foreground max-w-[120px] truncate" title={app.early_departure_notes}>
                            {app.early_departure_notes}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setEarlyDepartureApp(app)}
                        disabled={busy[app.id + '-early'] || !app.checked_in}
                        className="text-muted-foreground hover:text-terracotta-700 hover:bg-terracotta-50 text-xs gap-1"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Flag
                      </Button>
                    )}
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {app.booth_cleared ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-xs font-medium text-sage-800">
                          <CheckCircle2 className="h-3 w-3" />
                          Cleared
                        </span>
                        {app.booth_cleared_photo_url && (
                          <a
                            href={app.booth_cleared_photo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-sage-700 hover:underline"
                          >
                            <ImageIcon className="h-3 w-3" />
                            Photo
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-harvest-700 font-medium">Pending</span>
                    )}
                  </td>
                </tr>
              )
            })}

            {apps.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                  No approved vendors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {earlyDepartureApp && (
        <EarlyDepartureDialog
          vendorName={
            earlyDepartureApp.passport?.business_name ?? earlyDepartureApp.vendor.full_name
          }
          open={!!earlyDepartureApp}
          onOpenChange={(open) => !open && setEarlyDepartureApp(null)}
          onConfirm={confirmEarlyDeparture}
        />
      )}
    </div>
  )
}
