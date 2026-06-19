import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { CoordinatorReliabilityBadge } from '@/components/coordinator/coordinator-reliability-badge'

type Props = {
  coordinatorId: string
  coordinatorName: string
  reliabilityScore: number
  isVerified: boolean | null | undefined
}

export function OrganizerPlatformReliabilitySection({
  coordinatorId,
  coordinatorName,
  reliabilityScore,
  isVerified,
}: Props) {
  return (
    <section className="rounded-2xl border border-sage-200 bg-sage-50/60 p-6 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-sage-700" aria-hidden />
        <h2 className="text-lg font-semibold text-sage-950">Platform reliability</h2>
      </div>
      <p className="text-xs text-sage-900/80">
        PopUp Hub transaction data for markets run by this claimed organizer.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <CoordinatorReliabilityBadge score={reliabilityScore} />
        {isVerified ? (
          <span className="text-xs font-medium text-sage-800">Verified organizer</span>
        ) : null}
      </div>
      <p className="text-sm text-sage-950">
        Managed by{' '}
        <Link href={`/coordinators/${coordinatorId}`} className="font-medium underline underline-offset-2">
          {coordinatorName}
        </Link>{' '}
        on PopUp Hub.
      </p>
    </section>
  )
}
