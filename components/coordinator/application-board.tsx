'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Clock, Users, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { BoothApplication, ApplicationStatus } from '@/types/database'

interface ApplicationBoardProps {
  applications: BoothApplication[]
  bookingMode: 'instant' | 'juried'
}

const COLUMNS: { status: ApplicationStatus; label: string; color: string }[] = [
  { status: 'pending', label: 'Pending Review', color: 'text-yellow-700 bg-yellow-50 border-yellow-100' },
  { status: 'approved', label: 'Approved', color: 'text-green-700 bg-green-50 border-green-100' },
  { status: 'waitlisted', label: 'Waitlisted', color: 'text-blue-700 bg-blue-50 border-blue-100' },
  { status: 'rejected', label: 'Declined', color: 'text-red-700 bg-red-50 border-red-100' },
]

export function ApplicationBoard({ applications, bookingMode }: ApplicationBoardProps) {
  const supabase = createClient()
  const [apps, setApps] = useState<BoothApplication[]>(applications)
  const [viewingApp, setViewingApp] = useState<BoothApplication | null>(null)
  const [isPending, startTransition] = useTransition()

  const grouped = COLUMNS.reduce<Record<ApplicationStatus, BoothApplication[]>>(
    (acc, col) => {
      acc[col.status] = apps.filter((a) => a.status === col.status)
      return acc
    },
    { pending: [], approved: [], waitlisted: [], rejected: [], cancelled: [] }
  )

  async function updateStatus(appId: string, newStatus: ApplicationStatus) {
    startTransition(async () => {
      const updates: Partial<BoothApplication> = { status: newStatus }
      if (newStatus === 'approved') {
        updates.approved_at = new Date().toISOString()
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
      const app = apps.find((a) => a.id === appId)
      if (app?.vendor_id && (newStatus === 'approved' || newStatus === 'rejected' || newStatus === 'waitlisted')) {
        const notifMessages: Partial<Record<ApplicationStatus, string>> = {
          approved: `✅ Your booth application has been approved! See you at the event.`,
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
              metadata: { application_id: appId },
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
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-xl border">
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-gray-400" />
          <span className="font-medium">{totalApps}</span>
          <span className="text-gray-500">total applications</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="font-medium text-green-700">{approvedCount} approved</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-yellow-500" />
          <span className="font-medium text-yellow-700">{pendingCount} awaiting review</span>
        </div>
        {bookingMode === 'instant' && (
          <Badge className="bg-amber-100 text-amber-700 text-xs">
            ⚡ Instant booking — applications auto-approve
          </Badge>
        )}
      </div>

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
                  <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
                    <p className="text-xs text-gray-400">None here</p>
                  </div>
                ) : (
                  colApps.map((app) => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      onView={() => setViewingApp(app)}
                      onApprove={() => updateStatus(app.id, 'approved')}
                      onReject={() => updateStatus(app.id, 'rejected')}
                      onWaitlist={() => updateStatus(app.id, 'waitlisted')}
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
          {viewingApp && <VendorDetailModal app={viewingApp} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ApplicationCard({
  app,
  onView,
  onApprove,
  onReject,
  onWaitlist,
  loading,
}: {
  app: BoothApplication
  onView: () => void
  onApprove: () => void
  onReject: () => void
  onWaitlist: () => void
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
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={passport?.logo_url ?? vendor?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-amber-100 text-amber-700 text-[10px] font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            {app.category && (
              <Badge variant="outline" className="text-[9px] mt-0.5">
                {app.category.name}
              </Badge>
            )}
          </div>
        </div>

        <p className="text-[10px] text-gray-400">
          Applied {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
        </p>

        <div className="flex gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2 gap-1 text-gray-600"
            onClick={onView}
          >
            <Eye className="h-3 w-3" />
            View
          </Button>
          {app.status !== 'approved' && (
            <Button
              size="sm"
              className="h-6 text-[10px] px-2 gap-1 bg-green-500 hover:bg-green-600 text-white"
              onClick={onApprove}
              disabled={loading}
            >
              <CheckCircle className="h-3 w-3" />
              Approve
            </Button>
          )}
          {app.status !== 'waitlisted' && app.status !== 'rejected' && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 gap-1 text-blue-600 border-blue-200"
              onClick={onWaitlist}
              disabled={loading}
            >
              Waitlist
            </Button>
          )}
          {app.status !== 'rejected' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 gap-1 text-red-500 hover:bg-red-50"
              onClick={onReject}
              disabled={loading}
            >
              <XCircle className="h-3 w-3" />
              Decline
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function VendorDetailModal({ app }: { app: BoothApplication }) {
  const passport = app.passport
  const vendor = app.vendor
  const displayName = passport?.business_name ?? vendor?.full_name ?? 'Vendor'

  return (
    <>
      <DialogHeader>
        <DialogTitle>{displayName}</DialogTitle>
        <DialogDescription>
          Applied to: {app.category?.name}
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-2">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              <AvatarImage src={passport?.logo_url ?? vendor?.avatar_url ?? undefined} />
              <AvatarFallback className="text-lg bg-amber-100 text-amber-700 font-bold">
                {displayName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-lg">{displayName}</p>
              {passport?.is_verified && (
                <Badge className="bg-blue-100 text-blue-700 text-xs mt-1">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified Vendor
                </Badge>
              )}
            </div>
          </div>
          {passport?.bio && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">About</p>
              <p className="text-sm text-gray-700 leading-relaxed">{passport.bio}</p>
            </div>
          )}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Category</span>
              <Badge variant="outline">{app.category?.name}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Payment</span>
              <Badge
                className={
                  app.payment_status === 'paid'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }
              >
                {app.payment_status}
              </Badge>
            </div>
            {app.waitlist_position && (
              <div className="flex justify-between">
                <span className="text-gray-500">Waitlist position</span>
                <span className="font-medium">#{app.waitlist_position}</span>
              </div>
            )}
          </div>
        </div>

        {passport?.item_image_urls && passport.item_image_urls.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Product Photos</p>
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
