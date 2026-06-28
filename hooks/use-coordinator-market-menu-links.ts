'use client'

import { useEffect, useState } from 'react'
import type { AppMenuLink } from '@/components/nav/app-menu-sheet'
import { coordinatorStudioHref } from '@/lib/coordinator/coordinator-routes'

export function useCoordinatorMarketMenuLinks(enabled: boolean): AppMenuLink[] {
  const [links, setLinks] = useState<AppMenuLink[]>([])

  useEffect(() => {
    if (!enabled) {
      setLinks([])
      return
    }

    let cancelled = false

    void fetch('/api/coordinator/markets-menu')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { markets?: { id: string; name: string; coordinatorName?: string }[] } | null) => {
        if (cancelled || !data?.markets) return
        setLinks(
          data.markets.map((m) => ({
            href: `/coordinator/events/${m.id}`,
            label: m.coordinatorName ? `${m.name} · ${m.coordinatorName}` : m.name,
            title: m.coordinatorName
              ? `Open ${m.name} (Owner: ${m.coordinatorName})`
              : `Open ${m.name} — HubGrid: ${coordinatorStudioHref(m.id)}`,
          }))
        )
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [enabled])

  return links
}
