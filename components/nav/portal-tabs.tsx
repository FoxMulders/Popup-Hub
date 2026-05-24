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
      const res = await fetch('/api/portals/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal }),
      })

      if (!res.ok) return

      const data = (await res.json()) as { redirectTo?: string }
      const target = data.redirectTo ?? getPortalHome(portal)
      router.push(target)
      router.refresh()
    })
  }

  return (
    <div
      role="tablist"
      aria-label="Switch portal"
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1',
        compact && 'gap-0.5',
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
              'shrink-0 rounded-md px-2.5 py-2 text-xs font-medium transition-colors touch-manipulation min-h-11 sm:px-3 sm:text-sm',
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              pending && !selected && 'opacity-60'
            )}
          >
            {PORTAL_LABELS[portal]}
          </button>
        )
      })}
    </div>
  )
}
