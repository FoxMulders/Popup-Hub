'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getPortalHome, PORTAL_LABELS, type ActivePortal } from '@/lib/portals/active-portal'
import { resetScrollToTop } from '@/lib/navigation/scroll-to-top'
import { cn } from '@/lib/utils'

interface PortalTabsProps {
  availablePortals: ActivePortal[]
  activePortal: ActivePortal
  className?: string
  /** Tighter padding for inline header row (logo + tabs + menu). */
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

        resetScrollToTop()
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
        'inline-flex max-w-full items-center gap-0.5 overflow-x-hidden rounded-full border border-stone-200/80 bg-stone-200/45 p-0.5 shadow-[inset_0_1px_2px_rgb(62_45_28_/_0.06)] sm:p-1',
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
              'shrink-0 rounded-full font-semibold transition-all touch-manipulation',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/35 focus-visible:ring-offset-2',
              compact
                ? 'min-h-9 px-2.5 py-1.5 text-[11px] sm:min-h-10 sm:px-3.5 sm:py-2 sm:text-xs'
                : 'min-h-11 px-3.5 py-2 text-xs sm:px-4 sm:text-sm',
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
