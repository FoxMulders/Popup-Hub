'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { BadgeCheck, Loader2, ShieldCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  organizerClaimMatchReasonLabel,
  type OrganizerClaimSuggestion,
} from '@/lib/organizers/match-coordinator-organizers'
import { cn } from '@/lib/utils'

const DISMISS_STORAGE_KEY = 'popup-hub:dismissed-organizer-claim-suggestions'

interface CoordinatorOrganizerClaimSuggestionsProps {
  suggestions: OrganizerClaimSuggestion[]
  className?: string
}

function readDismissedSlugs(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((value): value is string => typeof value === 'string'))
  } catch {
    return new Set()
  }
}

function writeDismissedSlugs(slugs: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify([...slugs]))
  } catch {
    // ignore
  }
}

export function CoordinatorOrganizerClaimSuggestions({
  suggestions,
  className,
}: CoordinatorOrganizerClaimSuggestionsProps) {
  const router = useRouter()
  const [dismissedSlugs, setDismissedSlugs] = useState<Set<string>>(() => readDismissedSlugs())
  const [claimingSlug, setClaimingSlug] = useState<string | null>(null)

  const visibleSuggestions = useMemo(
    () => suggestions.filter((row) => !dismissedSlugs.has(row.slug)),
    [dismissedSlugs, suggestions]
  )

  if (visibleSuggestions.length === 0) return null

  function dismissSuggestion(slug: string) {
    setDismissedSlugs((prev) => {
      const next = new Set(prev)
      next.add(slug)
      writeDismissedSlugs(next)
      return next
    })
  }

  async function handleClaim(slug: string, displayName: string) {
    setClaimingSlug(slug)
    try {
      const res = await fetch(`/api/organizers/${slug}/claim`, { method: 'POST' })
      const data = (await res.json()) as { error?: string; nextPath?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not claim profile')
        return
      }
      toast.success(`You claimed ${displayName}.`)
      dismissSuggestion(slug)
      if (data.nextPath) router.push(data.nextPath)
      else router.refresh()
    } finally {
      setClaimingSlug(null)
    }
  }

  return (
    <section
      className={cn('marketing-glass-card space-y-4 p-6', className)}
      aria-labelledby="coordinator-claim-suggestions"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            id="coordinator-claim-suggestions"
            className="inline-flex items-center gap-2 text-sm font-bold text-foreground"
          >
            <ShieldCheck className="h-4 w-4 text-forest" aria-hidden />
            HubGuard profiles that may be yours
          </p>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            We matched your coordinator profile to unclaimed trust listings. Claim yours to respond
            to vendor reviews and sync published markets.
          </p>
        </div>
        <Link
          href="/check"
          className="shrink-0 text-xs font-semibold text-forest hover:underline underline-offset-2"
        >
          Browse all
        </Link>
      </div>

      <ul className="space-y-3">
        {visibleSuggestions.map((row) => (
          <li
            key={row.organizerId}
            className="rounded-xl border border-stone-200/80 bg-white/90 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{row.displayName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {row.city}, {row.province}
                </p>
                <ul className="mt-2 space-y-0.5">
                  {row.reasons.slice(0, 2).map((reason) => (
                    <li key={reason} className="text-xs text-muted-foreground">
                      · {organizerClaimMatchReasonLabel(reason)}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => dismissSuggestion(row.slug)}
                className="rounded-md p-1 text-muted-foreground hover:bg-stone-100 hover:text-foreground"
                aria-label={`Dismiss ${row.displayName}`}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={claimingSlug === row.slug}
                onClick={() => void handleClaim(row.slug, row.displayName)}
              >
                {claimingSlug === row.slug ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <BadgeCheck className="h-4 w-4" aria-hidden />
                )}
                Claim profile
              </Button>
              <Link
                href={`/organizers/${row.slug}`}
                className="text-xs font-medium text-harvest-800 hover:underline underline-offset-2"
              >
                View trust report →
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
