'use client'

import { useRouter } from 'next/navigation'
import { Store, Compass } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import type { ActivePortal } from '@/lib/portals/active-portal'

interface PortalSwitcherProps {
  hasVendorAccess: boolean
  currentPortal: ActivePortal
}

export function PortalSwitcherMenuItems({
  hasVendorAccess,
  currentPortal,
}: PortalSwitcherProps) {
  const router = useRouter()

  async function switchPortal(portal: ActivePortal) {
    await fetch('/api/portals/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portal }),
    })
    router.push(portal === 'vendor' ? '/vendor/dashboard' : '/discover')
    router.refresh()
  }

  if (currentPortal === 'markets' && hasVendorAccess) {
    return (
      <DropdownMenuItem
        onClick={() => switchPortal('vendor')}
        className="cursor-pointer gap-2"
      >
        <Store className="h-4 w-4" />
        Switch to Vendor Portal
      </DropdownMenuItem>
    )
  }

  if (currentPortal === 'vendor') {
    return (
      <DropdownMenuItem
        onClick={() => switchPortal('markets')}
        className="cursor-pointer gap-2"
      >
        <Compass className="h-4 w-4" />
        Switch to Markets
      </DropdownMenuItem>
    )
  }

  return null
}
