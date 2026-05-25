'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { VendorLogo } from '@/components/vendor/vendor-logo'
import { ApplicationDocumentLink } from '@/components/applications/application-document-link'
import { PassportVerificationBadge } from '@/components/coordinator/application-board-shared'
import { resolveApplicationDisplayCategories } from '@/lib/applications/display-categories'
import {
  buildInsuranceReviewStatus,
  buildMarketInventorySummary,
  buildVendorRequestSummary,
} from '@/lib/applications/vendor-review-context'
import type { VendorPlatformHistory } from '@/lib/applications/vendor-review-stats'
import { getVendorLinks } from '@/lib/shopper/vendors'
import { formatCategoryOverflowLabel } from '@/lib/vendor/application-category-match'
import {
  formatApplicationPaymentLabel,
  isApplicationPaid,
  needsEtransferCoordinatorReview,
  needsSquareCheckout,
} from '@/lib/applications/payment-fields'
import { formatAttendanceDayLabels } from '@/lib/events/event-schedule-days'
import { marketStatusBadge } from '@/lib/theme/market'
import type { BoothApplication, EventCategoryLimit } from '@/types/database'
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  Globe,
  Loader2,
  ShoppingBag,
  XCircle,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const LINK_ICONS = {
  website_url: Globe,
  shop_url: ShoppingBag,
  instagram_url: Camera,
} as const

const HISTORY_TONE: Record<VendorPlatformHistory['reliabilityTone'], string> = {
  success: 'border-sage-200 bg-sage-50 text-sage-900',
  warning: 'border-harvest-300 bg-harvest-50 text-harvest-900',
  danger: 'border-terracotta-300 bg-terracotta-50 text-terracotta-900',
  neutral: 'border-stone-200 bg-canvas text-foreground',
}

interface VendorReviewDrawerProps {
  app: BoothApplication | null
  open: boolean
  onOpenChange: (open: boolean) => void
  applications: BoothApplication[]
  categoryNameById: Record<string, string>
  categoryLimits: EventCategoryLimit[]
  marketInsuranceRequired: boolean
  eventCancelled?: boolean
  loading?: boolean
  verifying?: boolean
  onVerify: () => void
  onConfirmEtransfer: () => void
  onApprove: () => void
  onWaitlist: () => void
  onDecline: (message: string) => void
}

export function VendorReviewDrawer({
  app,
  open,
  onOpenChange,
  applications,
  categoryNameById,
  categoryLimits,
  marketInsuranceRequired,
  eventCancelled,
  loading,
  verifying,
  onVerify,
  onConfirmEtransfer,
  onApprove,
  onWaitlist,
  onDecline,
}: VendorReviewDrawerProps) {
  const [history, setHistory] = useState<VendorPlatformHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineMessage, setDeclineMessage] = useState('')
  const [, startNotesTransition] = useTransition()

  useEffect(() => {
    if (!open || !app) {
      setHistory(null)
      return
    }

    let cancelled = false
    setHistoryLoading(true)

    void fetch(`/api/coordinator/applications/${app.id}/review`)
      .then(async (res) => {
        const data = (await res.json()) as {
          history?: VendorPlatformHistory
          coordinatorReviewNotes?: string
          error?: string
        }
        if (!res.ok) throw new Error(data.error ?? 'Failed to load vendor history')
        if (cancelled) return
        setHistory(data.history ?? null)
        setNotes(data.coordinatorReviewNotes ?? '')
      })
      .catch(() => {
        if (!cancelled) setHistory(null)
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, app?.id])

  const categoryLimit = useMemo(
    () => categoryLimits.find((limit) => limit.category_id === app?.category_id) ?? null,
    [app?.category_id, categoryLimits],
  )

  const requestSummary = useMemo(
    () => (app ? buildVendorRequestSummary(app, categoryNameById, categoryLimit) : null),
    [app, categoryNameById, categoryLimit],
  )

  const marketSummary = useMemo(
    () => (app ? buildMarketInventorySummary(app, applications, categoryLimits) : null),
    [app, applications, categoryLimits],
  )

  const insuranceStatus = useMemo(
    () => (app ? buildInsuranceReviewStatus(app, marketInsuranceRequired) : null),
    [app, marketInsuranceRequired],
  )

  if (!app) return null

  const passport = app.passport
  const vendor = app.vendor
  const displayName = passport?.business_name ?? vendor?.full_name ?? 'Vendor'
  const displayCategories = resolveApplicationDisplayCategories(app, categoryNameById)
  const links = getVendorLinks(passport)
  const productImages = passport?.item_image_urls ?? []
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const canTakeAction =
    !eventCancelled &&
    !loading &&
    (app.status === 'pending' ||
      app.status === 'waitlisted' ||
      app.status === 'rejected' ||
      app.status === 'approved')

  const approveLabel =
    needsSquareCheckout(app) || app.payment_status === 'payment_required'
      ? 'Approve & Send Invoice'
      : needsEtransferCoordinatorReview(app)
        ? 'Approve — E-transfer Pending'
        : 'Approve Application'

  function saveNotes(nextNotes: string) {
    if (!app) return
    startNotesTransition(async () => {
      setNotesSaving(true)
      try {
        await fetch(`/api/coordinator/applications/${app.id}/review`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coordinatorReviewNotes: nextNotes }),
        })
      } finally {
        setNotesSaving(false)
      }
    })
  }

  function handleDeclineConfirm() {
    onDecline(declineMessage.trim())
    setDeclineOpen(false)
    setDeclineMessage('')
    onOpenChange(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-hidden p-0 sm:max-w-2xl"
          showCloseButton
        >
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b px-6 py-5 text-left">
              <SheetTitle className="font-heading text-2xl">{displayName}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                {displayCategories.map((name) => (
                  <Badge key={name} variant="outline">
                    {name}
                  </Badge>
                ))}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <section className="flex items-start gap-4">
                <VendorLogo
                  src={passport?.logo_url ?? vendor?.avatar_url}
                  alt={`${displayName} logo`}
                  fallback={initials}
                  size="lg"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <PassportVerificationBadge
                      isVerified={!!passport?.is_verified}
                      onVerify={onVerify}
                      verifying={!!verifying}
                    />
                    {passport?.tax_id_encrypted ? (
                      <Badge variant="outline" className="text-xs">
                        Tax ID on file
                      </Badge>
                    ) : null}
                  </div>
                  {passport?.bio ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">{passport.bio}</p>
                  ) : null}
                  {links.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {links.map((link) => {
                        const Icon = LINK_ICONS[link.field] ?? Globe
                        return (
                          <a
                            key={link.field}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-canvas"
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {link.label}
                          </a>
                        )
                      })}
                    </div>
                  ) : null}
                  {vendor?.email ? (
                    <p className="text-xs text-muted-foreground">
                      Contact:{' '}
                      <Link href={`mailto:${vendor.email}`} className="font-medium text-harvest-700 hover:underline">
                        {vendor.email}
                      </Link>
                      {vendor.phone ? ` · ${vendor.phone}` : ''}
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-2xl border bg-canvas/60 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Vendor History & Trust Score
                </h3>
                {historyLoading ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading platform history…
                  </div>
                ) : history ? (
                  <>
                    <div
                      className={cn(
                        'mt-3 rounded-xl border px-3 py-2 text-sm font-semibold',
                        HISTORY_TONE[history.reliabilityTone],
                      )}
                    >
                      {history.reliabilityLabel}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        { label: 'Approved', value: history.approved },
                        { label: 'Declined', value: history.declined },
                        { label: 'Participated', value: history.participated },
                        { label: 'No-show / Canceled', value: history.noShowCanceled },
                      ].map((item) => (
                        <div key={item.label} className="rounded-xl border bg-white px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {item.label}
                          </p>
                          <p className="mt-1 text-lg font-semibold tabular-nums">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No prior application history found.</p>
                )}
              </section>

              {productImages.length > 0 ? (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Product Showcase
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {productImages.map((url, index) => (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        className="group overflow-hidden rounded-xl border bg-white"
                        onClick={() => setPreviewImage(url)}
                      >
                        <img
                          src={url}
                          alt={`Product ${index + 1}`}
                          className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]"
                        />
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {requestSummary && marketSummary ? (
                <section className="space-y-3 rounded-2xl border p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Market Compatibility
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-white p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Vendor Requested
                      </p>
                      <ul className="mt-2 space-y-1 text-sm">
                        <li>{requestSummary.categoryName}</li>
                        <li>{requestSummary.tableLabel}</li>
                        <li>{requestSummary.boothLabel}</li>
                        {requestSummary.powerRequired ? (
                          <li className="inline-flex items-center gap-1 font-medium text-harvest-800">
                            <Zap className="h-3.5 w-3.5" />
                            Needs electricity
                          </li>
                        ) : null}
                        {requestSummary.neighborPreference ? (
                          <li className="text-muted-foreground">
                            Stand beside: {requestSummary.neighborPreference}
                          </li>
                        ) : null}
                      </ul>
                    </div>
                    <div className="rounded-xl border bg-white p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Market Status
                      </p>
                      <ul className="mt-2 space-y-1 text-sm">
                        <li>{marketSummary.powerLabel}</li>
                        <li>{formatApplicationPaymentLabel(app)}</li>
                        {app.attending_dates?.length ? (
                          <li>{formatAttendanceDayLabels(app.attending_dates).join(', ')}</li>
                        ) : null}
                      </ul>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'rounded-xl border px-3 py-2 text-sm',
                      marketSummary.categoryCapTone === 'full'
                        ? 'border-terracotta-200 bg-terracotta-50 text-terracotta-900'
                        : marketSummary.categoryCapTone === 'low'
                          ? 'border-harvest-300 bg-harvest-50 text-harvest-900'
                          : 'border-stone-200 bg-canvas text-foreground',
                    )}
                  >
                    <p className="font-medium">{marketSummary.categoryCapLabel}</p>
                    {marketSummary.categoryCapTone === 'full' ? (
                      <p className="mt-1 text-xs">Approving may require a waitlist or category exception.</p>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {insuranceStatus ? (
                <section className="rounded-2xl border p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Insurance Verification
                  </h3>
                  <div
                    className={cn(
                      'mt-3 rounded-xl border px-3 py-2',
                      insuranceStatus.tone === 'success'
                        ? 'border-sage-200 bg-sage-50'
                        : insuranceStatus.tone === 'warning'
                          ? 'border-harvest-300 bg-harvest-50'
                          : 'border-stone-200 bg-canvas',
                    )}
                  >
                    <p className="font-medium">{insuranceStatus.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{insuranceStatus.detail}</p>
                    {insuranceStatus.documentUrl ? (
                      <div className="mt-2">
                        <ApplicationDocumentLink
                          label="View insurance document"
                          url={insuranceStatus.documentUrl}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-2">
                    <ApplicationDocumentLink
                      label="Permits / documentation"
                      url={app.applicable_documentation_url}
                    />
                  </div>
                </section>
              ) : null}

              {app.has_category_overflow ? (
                <Badge className="w-fit gap-1 border border-violet-400 bg-violet-100 text-violet-950">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {formatCategoryOverflowLabel(app.overflow_category_names ?? []) ||
                    'Multi-Category Exception'}
                </Badge>
              ) : null}

              <section className="space-y-2">
                <Label htmlFor="coordinator-review-notes">Internal coordinator notes</Label>
                <Textarea
                  id="coordinator-review-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  onBlur={() => saveNotes(notes)}
                  placeholder="Products look great, fits our handmade theme perfectly…"
                  rows={4}
                />
                {notesSaving ? (
                  <p className="text-xs text-muted-foreground">Saving notes…</p>
                ) : null}
              </section>
            </div>

            <div className="border-t bg-white px-6 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {!eventCancelled && needsEtransferCoordinatorReview(app) ? (
                  <Button
                    className="w-full bg-sky-700 hover:bg-sky-800 sm:w-auto"
                    onClick={onConfirmEtransfer}
                    disabled={loading}
                  >
                    Confirm e-transfer received
                  </Button>
                ) : null}
                {!eventCancelled && app.status !== 'approved' && app.status !== 'pending_insurance' ? (
                  <Button
                    className="w-full gap-1.5 sm:flex-1"
                    onClick={() => {
                      onApprove()
                      onOpenChange(false)
                    }}
                    disabled={!canTakeAction}
                  >
                    <CheckCircle className="h-4 w-4" />
                    {approveLabel}
                  </Button>
                ) : null}
                {!eventCancelled && app.status !== 'waitlisted' && app.status !== 'rejected' ? (
                  <Button
                    variant="outline"
                    className="w-full gap-1.5 border-harvest-300 text-harvest-800 sm:w-auto"
                    onClick={() => {
                      onWaitlist()
                      onOpenChange(false)
                    }}
                    disabled={!canTakeAction}
                  >
                    Waitlist
                  </Button>
                ) : null}
                {!eventCancelled && app.status !== 'rejected' ? (
                  <Button
                    variant="outline"
                    className="w-full gap-1.5 text-terracotta-700 hover:bg-terracotta-50 sm:w-auto"
                    onClick={() => setDeclineOpen(true)}
                    disabled={!canTakeAction}
                  >
                    <XCircle className="h-4 w-4" />
                    Decline with Message
                  </Button>
                ) : null}
                {app.status === 'approved' && isApplicationPaid(app) ? (
                  <Badge className={`${marketStatusBadge.success} w-full justify-center py-2 sm:w-auto`}>
                    Approved & paid
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!previewImage} onOpenChange={(next) => !next && setPreviewImage(null)}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-2 shadow-none">
          {previewImage ? (
            <img
              src={previewImage}
              alt="Product preview"
              className="max-h-[80vh] w-full rounded-xl object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline application</DialogTitle>
            <DialogDescription>
              Optional message for {displayName}. They will receive this in their notification.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={declineMessage}
            onChange={(event) => setDeclineMessage(event.target.value)}
            placeholder="Thank you for applying. We had limited spots in your category this round…"
            rows={4}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeclineConfirm}
              disabled={loading}
            >
              Decline application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
