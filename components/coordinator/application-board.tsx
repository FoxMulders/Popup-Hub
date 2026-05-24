'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { VendorLogo } from '@/components/vendor/vendor-logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Clock, Users, Eye, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { marketChip, marketStatusBadge } from '@/lib/theme/market'
import { formatAttendanceDayLabels } from '@/lib/events/event-schedule-days'
import { formatCategoryOverflowLabel } from '@/lib/vendor/application-category-match'
import { resolveApplicationDisplayCategories } from '@/lib/applications/display-categories'
import type { BoothApplication, ApplicationStatus } from '@/types/database'

interface ApplicationBoardProps {
  applications: BoothApplication[]
  bookingMode: 'instant' | 'juried'
  eventCancelled?: boolean
  categoryNameById?: Record<string, string>
  categoryLimits?: Array<{
    category_id: string
    max_slots: number
    price_per_booth?: number
    category?: { name: string } | null
  }>
}

function ApplicationCategoryBadges({
  app,
  categoryNameById,
  compact,
}: {
  app: BoothApplication
  categoryNameById: Record<string, string>
  compact?: boolean
}) {
  const displayCategories = resolveApplicationDisplayCategories(app, categoryNameById)

  return (
    <div className={`flex flex-wrap gap-1 ${compact ? 'mt-0.5' : 'mt-1'}`}>
      {displayCategories.map((name) => (
        <Badge key={`${app.id}-${name}`} variant="outline" className={compact ? 'text-[9px]' : 'text-xs'}>
          {name}
        </Badge>
      ))}
    </div>
  )
}

function CategoryOverflowBadge({ app }: { app: BoothApplication }) {
  if (!app.has_category_overflow) return null

  const label = formatCategoryOverflowLabel(app.overflow_category_names ?? [])

  return (
    <Badge className="w-full justify-center gap-1 border border-violet-400 bg-violet-100 text-violet-950 text-[10px] font-semibold py-1">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {label || 'Multi-Category Exception'}
    </Badge>
  )
}

const COLUMNS: { status: ApplicationStatus; label: string; color: string }[] = [
  { status: 'pending', label: 'Pending Review', color: 'text-harvest-800 bg-harvest-50 border-harvest-200' },
  { status: 'approved', label: 'Approved', color: 'text-sage-800 bg-sage-50 border-sage-200' },
  { status: 'waitlisted', label: 'Waitlisted', color: 'text-muted-foreground bg-canvas border-stone-200' },
  { status: 'rejected', label: 'Declined', color: 'text-terracotta-800 bg-terracotta-50 border-terracotta-200' },
]

export function ApplicationBoard({
  applications,
  bookingMode,
  eventCancelled,
  categoryNameById,
  categoryLimits = [],
}: ApplicationBoardProps) {
  const supabase = createClient()
  const [apps, setApps] = useState<BoothApplication[]>(applications)
  const categoryLookup = categoryNameById ?? {}
  const [viewingApp, setViewingApp] = useState<BoothApplication | null>(null)
  const [isPending, startTransition] = useTransition()
  const [verifyingVendorId, setVerifyingVendorId] = useState<string | null>(null)

  useEffect(() => {
    setApps(applications)
  }, [applications])

  function markVendorVerified(vendorId: string) {
    const patch = (a: BoothApplication) =>
      a.vendor_id === vendorId && a.passport
        ? { ...a, passport: { ...a.passport, is_verified: true } }
        : a

    setApps((prev) => prev.map(patch))
    setViewingApp((prev) => (prev ? patch(prev) : null))
  }

  async function verifyVendor(vendorId: string, eventId: string) {
    const previousApps = apps
    const previousViewing = viewingApp

    markVendorVerified(vendorId)
    setVerifyingVendorId(vendorId)

    try {
      const res = await fetch('/api/coordinator/verify-vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId, eventId }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setApps(previousApps)
        setViewingApp(previousViewing)
        toast.error(data.error ?? 'Failed to verify vendor passport')
        return
      }

      toast.success('Vendor passport verified')
    } catch {
      setApps(previousApps)
      setViewingApp(previousViewing)
      toast.error('Failed to verify vendor passport')
    } finally {
      setVerifyingVendorId(null)
    }
  }

  const grouped = COLUMNS.reduce<Record<ApplicationStatus, BoothApplication[]>>(
    (acc, col) => {
      acc[col.status] = apps.filter((a) => a.status === col.status)
      return acc
    },
    { pending: [], approved: [], waitlisted: [], rejected: [], cancelled: [] }
  )

  async function updateStatus(appId: string, newStatus: ApplicationStatus) {
    startTransition(async () => {
      const app = apps.find((a) => a.id === appId)
      if (!app) return

      if (newStatus === 'approved' && app.category_id && categoryLimits.length > 0) {
        const limit = categoryLimits.find((cl) => cl.category_id === app.category_id)
        if (limit) {
          const approvedInCategory = apps.filter(
            (a) => a.status === 'approved' && a.category_id === app.category_id
          ).length
          if (approvedInCategory >= limit.max_slots) {
            toast.error(
              `${limit.category?.name ?? 'This category'} is full (${limit.max_slots} slots)`
            )
            return
          }
        }
      }

      const updates: Partial<BoothApplication> = { status: newStatus }
      if (newStatus === 'approved') {
        updates.approved_at = new Date().toISOString()
        const limit = categoryLimits.find((cl) => cl.category_id === app.category_id)
        const boothPrice = limit?.price_per_booth ?? 0
        if (boothPrice > 0) {
          updates.payment_status = 'payment_required'
        }
      }

      const { error } = await supabase
        .from('booth_applications')
        .update(updates)
        .eq('id', appId)

      if (error) {
        toast.error('Failed to update application status')
        return
      }

      setApps((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, ...updates } : a))
      )

      // Send in-app + SMS notification to vendor
      if (app.vendor_id && (newStatus === 'approved' || newStatus === 'rejected' || newStatus === 'waitlisted')) {
        const notifMessages: Partial<Record<ApplicationStatus, string>> = {
          approved:
            updates.payment_status === 'payment_required'
              ? '✅ Your booth application has been approved! Complete your payment to secure your spot.'
              : '✅ Your booth application has been approved! See you at the event.',
          rejected: `Your booth application was not selected this time. Keep an eye out for future events!`,
          waitlisted: `Your application has been waitlisted. We'll notify you if a spot opens up.`,
        }
        const message = notifMessages[newStatus]
        if (message) {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: app.vendor_id,
              type: newStatus === 'approved' ? 'application_approved' : newStatus === 'rejected' ? 'application_rejected' : 'waitlist_triggered',
              message,
              metadata: {
                application_id: appId,
                event_id: app.event_id,
                payment_required: updates.payment_status === 'payment_required',
              },
              send_sms: true,
            }),
          })
        }
      }

      const labels: Record<ApplicationStatus, string> = {
        approved: '✅ Application approved — vendor notified',
        rejected: 'Application declined — vendor notified',
        waitlisted: 'Moved to waitlist — vendor notified',
        pending: 'Moved back to pending',
        cancelled: 'Application cancelled',
      }
      toast.success(labels[newStatus])
    })
  }

  const totalApps = apps.length
  const approvedCount = grouped.approved.length
  const pendingCount = grouped.pending.length

  return (
    <div className="space-y-6">
      {eventCancelled && (
        <div className="rounded-xl border-2 border-terracotta-200 bg-terracotta-50 px-4 py-3 text-center">
          <p className="text-sm font-heading font-bold uppercase tracking-wide text-terracotta-800">
            Event Canceled — Refunds Processed
          </p>
          <p className="mt-1 text-xs text-terracotta-700">
            This market is closed. Vendor applications are read-only.
          </p>
        </div>
      )}

      {/* Summary bar */}
      <dl className="flex flex-wrap gap-4 p-4 market-panel rounded-xl">
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
          <dt className="sr-only">Total applications</dt>
          <dd className="font-medium text-foreground">{totalApps} total applications</dd>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-sage-600" aria-hidden />
          <dt className="sr-only">Approved</dt>
          <dd className="font-medium text-sage-800">{approvedCount} approved</dd>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-harvest-500" aria-hidden />
          <dt className="sr-only">Pending</dt>
          <dd className="font-medium text-harvest-800">{pendingCount} awaiting review</dd>
        </div>
        {bookingMode === 'instant' && (
          <Badge className={`${marketStatusBadge.warning} text-xs`}>
            ⚡ Instant booking — applications auto-approve
          </Badge>
        )}
      </dl>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
        {COLUMNS.map((col) => {
          const colApps = grouped[col.status]
          return (
            <div key={col.status} className="space-y-3">
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${col.color}`}>
                <span className="text-xs font-bold uppercase tracking-wide">{col.label}</span>
                <span className="text-xs font-bold">{colApps.length}</span>
              </div>

              <div className="space-y-2">
                {colApps.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-stone-200 py-8 text-center bg-canvas/50">
                    <p className="text-xs text-muted-foreground">None here</p>
                  </div>
                ) : (
                  colApps.map((app) => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      categoryNameById={categoryLookup}
                      eventCancelled={eventCancelled}
                      onView={() => setViewingApp(app)}
                      onApprove={() => updateStatus(app.id, 'approved')}
                      onReject={() => updateStatus(app.id, 'rejected')}
                      onWaitlist={() => updateStatus(app.id, 'waitlisted')}
                      onVerify={() => verifyVendor(app.vendor_id, app.event_id)}
                      verifying={verifyingVendorId === app.vendor_id}
                      loading={isPending}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Vendor detail modal */}
      <Dialog open={!!viewingApp} onOpenChange={(o) => !o && setViewingApp(null)}>
        <DialogContent className="max-w-2xl">
          {viewingApp && (
            <VendorDetailModal
              app={viewingApp}
              categoryNameById={categoryLookup}
              onVerify={() => verifyVendor(viewingApp.vendor_id, viewingApp.event_id)}
              verifying={verifyingVendorId === viewingApp.vendor_id}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PassportVerificationBadge({
  isVerified,
  onVerify,
  verifying,
  compact,
}: {
  isVerified: boolean
  onVerify: () => void
  verifying: boolean
  compact?: boolean
}) {
  if (isVerified) {
    return (
      <Badge className={`${marketStatusBadge.neutral} ${compact ? 'text-[10px]' : 'text-xs'}`}>
        <CheckCircle className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
        Verified
      </Badge>
    )
  }

  return (
    <div className={`flex ${compact ? 'flex-col gap-1.5' : 'flex-wrap items-center gap-2'}`}>
      <Badge className={`bg-stone-100 text-stone-600 ${compact ? 'text-[10px]' : 'text-xs'}`}>
        Unverified
      </Badge>
      <Button
        size="sm"
        variant="outline"
        className={`${compact ? 'min-h-9 text-[10px] px-2' : 'min-h-10 text-xs'} gap-1.5`}
        onClick={onVerify}
        disabled={verifying}
      >
        {verifying ? (
          <span className="animate-pulse">Verifying…</span>
        ) : (
          'Verify Vendor Passport'
        )}
      </Button>
    </div>
  )
}

function ApplicationCard({
  app,
  categoryNameById,
  eventCancelled,
  onView,
  onApprove,
  onReject,
  onWaitlist,
  onVerify,
  verifying,
  loading,
}: {
  app: BoothApplication
  categoryNameById: Record<string, string>
  eventCancelled?: boolean
  onView: () => void
  onApprove: () => void
  onReject: () => void
  onWaitlist: () => void
  onVerify: () => void
  verifying: boolean
  loading: boolean
}) {
  const passport = app.passport
  const vendor = app.vendor
  const displayName = passport?.business_name ?? vendor?.full_name ?? 'Vendor'
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <Card className="overflow-hidden hover:shadow-sm transition-shadow">
      {passport?.item_image_urls?.[0] && (
        <div className="h-20 overflow-hidden">
          <img
            src={passport.item_image_urls[0]}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <VendorLogo
            src={passport?.logo_url ?? vendor?.avatar_url}
            alt={`${displayName} logo`}
            fallback={initials}
            size="xs"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            <ApplicationCategoryBadges app={app} categoryNameById={categoryNameById} compact />
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Applied {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
        </p>
        {app.attending_dates?.length ? (
          <p className="text-[10px] text-muted-foreground">
            Days: {formatAttendanceDayLabels(app.attending_dates).join(', ')}
          </p>
        ) : null}

        {app.status === 'approved' && app.payment_status === 'payment_required' && (
          <Badge className="w-full justify-center bg-amber-100 text-amber-800 text-[10px] py-1">
            Awaiting vendor payment
          </Badge>
        )}

        {app.status === 'approved' && app.payment_status === 'paid' && (
          <Badge className="w-full justify-center bg-sage-100 text-sage-800 text-[10px] py-1">
            Paid
          </Badge>
        )}

        {eventCancelled && (
          <Badge className="w-full justify-center bg-terracotta-600 text-primary-foreground text-[10px] font-bold uppercase tracking-wide py-1 min-h-11">
            Event Canceled — Refund Processed
          </Badge>
        )}

        <CategoryOverflowBadge app={app} />

        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="min-h-11 text-xs px-3 gap-1.5"
            onClick={onView}
          >
            <Eye className="h-4 w-4" />
            View
          </Button>
          {!eventCancelled && app.status !== 'approved' && (
            <Button
              size="sm"
              className="min-h-11 text-xs px-3 gap-1.5"
              onClick={onApprove}
              disabled={loading}
            >
              <CheckCircle className="h-4 w-4" />
              Approve
            </Button>
          )}
          {!eventCancelled && app.status !== 'waitlisted' && app.status !== 'rejected' && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 text-xs px-3 gap-1.5 text-harvest-800 border-harvest-300"
              onClick={onWaitlist}
              disabled={loading}
            >
              Waitlist
            </Button>
          )}
          {!eventCancelled && app.status !== 'rejected' && (
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11 text-xs px-3 gap-1.5 text-terracotta-700 hover:bg-terracotta-50"
              onClick={onReject}
              disabled={loading}
            >
              <XCircle className="h-4 w-4" />
              Decline
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function VendorDetailModal({
  app,
  categoryNameById,
  onVerify,
  verifying,
}: {
  app: BoothApplication
  categoryNameById: Record<string, string>
  onVerify: () => void
  verifying: boolean
}) {
  const passport = app.passport
  const vendor = app.vendor
  const displayName = passport?.business_name ?? vendor?.full_name ?? 'Vendor'
  const displayCategories = resolveApplicationDisplayCategories(app, categoryNameById)

  return (
    <>
      <DialogHeader>
        <DialogTitle>{displayName}</DialogTitle>
        <DialogDescription>
          Applied to: {displayCategories.join(', ')}
        </DialogDescription>
      </DialogHeader>
      {app.has_category_overflow ? (
        <Badge className="mb-2 w-fit gap-1 border border-violet-400 bg-violet-100 text-violet-950 text-xs font-semibold">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {formatCategoryOverflowLabel(app.overflow_category_names ?? []) ||
            'Multi-Category Exception'}
        </Badge>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-2">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <VendorLogo
              src={passport?.logo_url ?? vendor?.avatar_url}
              alt={`${displayName} logo`}
              fallback={displayName[0]}
              size="md"
            />
            <div>
              <p className="font-semibold text-lg">{displayName}</p>
              <div className="mt-1">
                <PassportVerificationBadge
                  isVerified={!!passport?.is_verified}
                  onVerify={onVerify}
                  verifying={verifying}
                />
              </div>
              {app.vendor?.reliability_score != null && (
                <Badge className={`${marketStatusBadge.success} text-xs mt-1`}>
                  Reliability {app.vendor.reliability_score}%
                </Badge>
              )}
            </div>
          </div>
          {passport?.bio && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">About</p>
              <p className="text-sm text-foreground leading-relaxed">{passport.bio}</p>
            </div>
          )}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground shrink-0">Categories</span>
              <div className="flex flex-wrap justify-end gap-1">
                {displayCategories.map((name) => (
                  <Badge key={`${app.id}-detail-${name}`} variant="outline">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment</span>
              <Badge
                className={
                  app.payment_status === 'paid'
                    ? marketChip.paid
                    : marketChip.unpaid
                }
              >
                {app.payment_status}
              </Badge>
            </div>
            {app.waitlist_position && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Waitlist position</span>
                <span className="font-medium">#{app.waitlist_position}</span>
              </div>
            )}
            {app.attending_dates?.length ? (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">Attendance</span>
                <span className="font-medium text-right">
                  {formatAttendanceDayLabels(app.attending_dates).join(', ')}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {passport?.item_image_urls && passport.item_image_urls.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Product Photos</p>
            <div className="grid grid-cols-2 gap-2">
              {passport.item_image_urls.slice(0, 4).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Product ${i + 1}`}
                  className="aspect-square rounded-lg object-cover"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
