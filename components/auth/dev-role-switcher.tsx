'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { devMockLoginPath, loginWithMockRolePath, type DevMockRole } from '@/lib/auth/dev-mock-session'

const ROLES: { role: DevMockRole; label: string }[] = [
  { role: 'coordinator', label: 'Login as Coordinator' },
  { role: 'vendor', label: 'Login as Vendor' },
  { role: 'shopper', label: 'Login as Patron' },
]

export function DevRoleSwitcher() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div
      id="dev-role-switcher"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 rounded-xl border border-harvest-400 bg-harvest-50/95 p-3 shadow-lg backdrop-blur-sm max-w-[240px]"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-harvest-800">
        Dev role switcher
      </p>
      {ROLES.map(({ role, label }) => (
        <Button
          key={role}
          type="button"
          size="sm"
          variant="outline"
          className="h-8 justify-start border-harvest-200 bg-white text-xs hover:bg-harvest-100"
          onClick={() => {
            window.location.href = devMockLoginPath(role)
          }}
        >
          {label}
        </Button>
      ))}
      <p className="text-[10px] leading-snug text-harvest-700/90">
        Parallel testing: open one role per browser profile, then log in once and leave that
        profile alone. Switching roles here only affects this profile.
      </p>
      <div className="space-y-1 border-t border-harvest-200/80 pt-2 text-[10px] text-harvest-800/90">
        <p className="font-semibold">Bookmark per profile</p>
        {ROLES.map(({ role, label }) => (
          <a
            key={role}
            href={loginWithMockRolePath(role)}
            className="block truncate underline-offset-2 hover:underline"
          >
            {label}
          </a>
        ))}
      </div>
    </div>
  )
}
