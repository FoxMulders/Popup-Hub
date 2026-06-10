'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  getPortalHome,
  PORTAL_LABELS,
  type ActivePortal,
} from '@/lib/portals/active-portal'
import { cn } from '@/lib/utils'

interface PortalTabsProps {
  availablePortals: ActivePortal[]
  activePortal: ActivePortal
  className?: string
  compact?: boolean
}

export function PortalTabs({
  availablePortals,
  activePortal,
  className,
  compact = false,
}: PortalTabsProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (availablePortals.length <= 1) {
    return null
  }

  async function switchPortal(portal: ActivePortal) {
    if (portal === activePortal || pending) return

    startTransition(async () => {
      try {
        const res = await fetch('/api/portals/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portal }),
        })

        if (!res.ok) return

        const data = (await res.json().catch(() => ({}))) as {
          redirectTo?: string
        }
        const target = data.redirectTo ?? getPortalHome(portal)

        // We intentionally do NOT call router.refresh() after router.push():
        // refresh forces a re-fetch of the *current* segment with the new
        // cookie before the push has finished navigating, which on segments
        // whose shell wrapper depends on the portal cookie (e.g.
        // /notifications, which switches between PortalAwareShell variants)
        // races with the in-flight push and surfaces the segment-level
        // error boundary. Pushing alone is enough — the destination route
        // is fetched fresh with the new cookie state.
        router.push(target)
      } catch {
        // Network/abort errors during the transition shouldn't surface to
        // the user; the next portal click can retry.
      }
    })
  }

  return (
    <div
      role="tablist"
      aria-label="Switch portal"
      className={cn(
        'inline-flex max-w-full items-center gap-0.5 overflow-x-hidden rounded-full border border-stone-200/80 bg-stone-200/45 p-1 shadow-[inset_0_1px_2px_rgb(62_45_28_/_0.06)]',
        compact && 'w-full',
        className
      )}
    >
      {availablePortals.map((portal) => {
        const selected = portal === activePortal
        return (
          <button
            key={portal}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={pending}
            onClick={() => void switchPortal(portal)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-all touch-manipulation min-h-11 sm:px-4 sm:text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/35 focus-visible:ring-offset-2',
              compact && 'flex-1 text-center',
              selected
                ? 'bg-white text-forest shadow-[var(--shadow-market-md)] ring-1 ring-stone-200/70'
                : 'text-stone-700 hover:bg-white/55 hover:text-stone-900',
              pending && !selected && 'pointer-events-none opacity-45'
            )}
          >
            {PORTAL_LABELS[portal]}
          </button>
        )
      })}
    </div>
  )
}
