'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, ExternalLink, MessageSquare } from 'lucide-react'
import { vendorApplicationStatusHref } from '@/components/vendor/market-owner-link'
import { ApplicationFollowUpDialog } from '@/components/vendor/application-follow-up-dialog'
import { VENDOR_APPLICATION_STATUS_UI } from '@/lib/vendor/application-status-ui'
import type { ApplicationStatus, Event } from '@/types/database'

interface ApplicationStatusActionsProps {
  event: Event
  applicationId: string
  status: ApplicationStatus
}

function canFollowUp(status: ApplicationStatus): boolean {
  return status === 'pending' || status === 'waitlisted' || status === 'pending_insurance'
}

export function ApplicationStatusActions({
  event,
  applicationId,
  status,
}: ApplicationStatusActionsProps) {
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const statusHref = vendorApplicationStatusHref(event.id)
  const statusUi = VENDOR_APPLICATION_STATUS_UI[status]
  const coordinator = Array.isArray(event.coordinator) ? event.coordinator[0] : event.coordinator

  const hintByStatus: Partial<Record<ApplicationStatus, string>> = {
    pending: 'The organizer is reviewing your juried application.',
    waitlisted: "We'll notify you if a booth opens.",
    pending_insurance: 'Upload insurance from My Applications or follow up with the organizer.',
  }

  return (
    <>
      <div className="space-y-2.5">
        <Link href={statusHref} className="block">
          <Badge
            className={`w-full justify-center gap-1.5 py-2 text-xs cursor-pointer hover:opacity-90 ${statusUi.badgeClass}`}
          >
            <Clock className="h-3.5 w-3.5" />
            {statusUi.label}
            <ExternalLink className="h-3 w-3 opacity-70" />
          </Badge>
        </Link>

        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          {hintByStatus[status] ?? statusUi.nextStep}
        </p>

        <div className="flex flex-col gap-2">
          <Link href={statusHref}>
            <Button size="sm" variant="outline" className="w-full">
              View application status
            </Button>
          </Link>
          <Link href="/vendor/applications?filter=pending">
            <Button size="sm" variant="ghost" className="w-full text-muted-foreground">
              All my applications
            </Button>
          </Link>
          {canFollowUp(status) ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => setFollowUpOpen(true)}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Follow up with organizer
            </Button>
          ) : null}
        </div>
      </div>

      <ApplicationFollowUpDialog
        applicationId={applicationId}
        eventName={event.name}
        coordinatorName={coordinator?.full_name}
        coordinatorEmail={coordinator?.email}
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
      />
    </>
  )
}

/** Compact waitlisted / insurance-only variants without full panel duplication */
export function ApplicationStatusBadgeLink({
  event,
  status,
}: {
  event: Event
  status: ApplicationStatus
}) {
  const statusUi = VENDOR_APPLICATION_STATUS_UI[status]
  const statusHref = vendorApplicationStatusHref(event.id)

  return (
    <div className="space-y-2">
      <Link href={statusHref} className="block">
        <Badge className={`w-full justify-center py-1.5 ${statusUi.badgeClass}`}>{statusUi.label}</Badge>
      </Link>
      <Link href={statusHref} className="block text-center text-xs font-medium text-harvest-700 hover:underline">
        View status →
      </Link>
    </div>
  )
}
