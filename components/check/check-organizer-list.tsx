'use client'

import Link from 'next/link'
import { BadgeCheck } from 'lucide-react'
import type { Organizer } from '@/types/organizers'
import { cn } from '@/lib/utils'

interface CheckOrganizerListProps {
  organizers: Organizer[]
  query: string
  canClaim: boolean
}

export function CheckOrganizerList({ organizers, query, canClaim }: CheckOrganizerListProps) {
  if (organizers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-canvas px-4 py-8 text-center text-sm text-muted-foreground space-y-3">
        <p>
          {query.trim()
            ? 'No published organizers match that search yet.'
            : 'No organizers published yet. Listings appear here after verification.'}
        </p>
        <p>
          Organizer not listed?{' '}
          <Link
            href="/check/review"
            className="font-medium text-harvest-800 hover:underline underline-offset-2"
          >
            Submit a review
          </Link>{' '}
          and we&apos;ll add them after verification.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {organizers.map((org) => {
        const unclaimed = !org.claimed_by
        return (
          <li key={org.id}>
            <div className="rounded-xl border bg-white px-4 py-3 hover:bg-harvest-50/40 transition-colors">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link href={`/organizers/${org.slug}`} className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{org.display_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {org.city}, {org.province}
                    {org.typical_season_or_dates ? ` · ${org.typical_season_or_dates}` : null}
                  </p>
                </Link>
                {unclaimed ? (
                  <span className="inline-flex items-center rounded-full border border-stone-200 bg-canvas px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Unclaimed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sage-200 bg-sage-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sage-800">
                    <BadgeCheck className="h-3 w-3" aria-hidden />
                    Claimed
                  </span>
                )}
              </div>
              {canClaim && unclaimed ? (
                <Link
                  href={`/organizers/${org.slug}`}
                  className={cn(
                    'mt-2 inline-flex text-xs font-semibold text-harvest-800 hover:underline underline-offset-2'
                  )}
                >
                  Claim this profile →
                </Link>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
