'use client'

import { ApplyButton } from '@/components/events/apply-button'
import {
  QuickApplyButton,
  VendorEventApplyDeepLink,
} from '@/components/vendor/quick-apply-button'
import type { ApplicationStatus, Event, ApplicationPaymentStatus, PaymentMethod, PaymentStatus } from '@/types/database'

interface ExistingApplication {
  id: string
  status: ApplicationStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  application_payment_status: ApplicationPaymentStatus | null
}

interface VendorEventApplySectionProps {
  event: Event
  userId: string
  applicationStatus: ApplicationStatus | null
  applicationId: string | null
  existingApplication: ExistingApplication | null
  boothPriceCents: number
  applicationsOpen: boolean
  vendorCanVouch?: boolean
}

export function VendorEventApplySection(props: VendorEventApplySectionProps) {
  return (
    <>
      <VendorEventApplyDeepLink eventId={props.event.id} />
      <div className="md:hidden">
        <QuickApplyButton
          event={props.event}
          userId={props.userId}
          applicationStatus={props.applicationStatus}
          applicationId={props.applicationId}
          applicationsOpen={props.applicationsOpen}
        />
      </div>
      <div className="hidden md:block">
        <ApplyButton {...props} />
      </div>
    </>
  )
}
