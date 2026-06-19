import { Badge } from '@/components/ui/badge'
import {
  ATTENDANCE_LABELS,
  EVENT_AS_ADVERTISED_LABELS,
  REFUND_LABELS,
  VERIFICATION_TIER_LABELS,
} from '@/lib/organizers/review-labels'
import type { OrganizerReviewPublic } from '@/types/organizers'

function formatEventMonthYear(value: string): string {
  const [year, month] = value.split('-')
  if (!year || !month) return value
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
}

export function OrganizerReviewList({ reviews }: { reviews: OrganizerReviewPublic[] }) {
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No vendor reviews yet. Vended here? Be the first to share your experience.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {reviews.map((review) => (
        <li key={review.id} className="rounded-lg border bg-canvas px-3 py-3 text-sm space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium text-foreground">{review.event_name}</p>
              <p className="text-xs text-muted-foreground">
                {formatEventMonthYear(review.event_month_year)}
                {review.vendor_display_name ? ` · ${review.vendor_display_name}` : null}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {VERIFICATION_TIER_LABELS[review.verification_tier] ?? 'Vendor review'}
            </Badge>
          </div>
          <dl className="grid gap-1 text-xs text-muted-foreground">
            <div>
              <dt className="inline font-medium text-foreground">As advertised: </dt>
              <dd className="inline">
                {EVENT_AS_ADVERTISED_LABELS[review.event_as_advertised] ?? review.event_as_advertised}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">Would return: </dt>
              <dd className="inline">{review.would_return ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">Foot traffic: </dt>
              <dd className="inline">
                {ATTENDANCE_LABELS[review.attendance_vs_expectations] ??
                  review.attendance_vs_expectations}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">Communication: </dt>
              <dd className="inline">{review.communication_rating}/5</dd>
            </div>
            {review.refund_experience !== 'na' ? (
              <div>
                <dt className="inline font-medium text-foreground">Refund: </dt>
                <dd className="inline">
                  {REFUND_LABELS[review.refund_experience] ?? review.refund_experience}
                </dd>
              </div>
            ) : null}
          </dl>
          {review.optional_notes ? (
            <p className="text-xs text-foreground/90 border-t pt-2">{review.optional_notes}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
