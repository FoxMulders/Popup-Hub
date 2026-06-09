'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  availablePortalLabels,
  canSelfEnableCoordinator,
  canSelfEnableVendor,
  portalLabelsText,
  resolveCapabilityAccess,
  roleDisplayLabel,
  roleSummary,
} from '@/lib/auth/account-access'
import { getPortalHome, PORTAL_LABELS } from '@/lib/portals/active-portal'
import type { Role } from '@/types/database'
import { CheckCircle2, Circle, Loader2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

interface AccountAccessPanelProps {
  email: string
  role: Role
  isAdmin?: boolean
  ownedEventCount?: number
}

export function AccountAccessPanel({
  email,
  role,
  isAdmin = false,
  ownedEventCount = 0,
}: AccountAccessPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [localRole, setLocalRole] = useState(role)

  const accessProfile = { role: localRole, is_admin: isAdmin }
  const capabilities = resolveCapabilityAccess(accessProfile)
  const portals = availablePortalLabels(accessProfile)
  const canEnableCoordinator = canSelfEnableCoordinator(localRole)
  const canEnableVendor = canSelfEnableVendor(localRole)

  function enableVendorAccess() {
    startTransition(async () => {
      const res = await fetch('/api/profile/enable-vendor', { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as { error?: string }

      if (!res.ok) {
        toast.error(data.error ?? 'Could not enable vendor access')
        return
      }

      setLocalRole('vendor')
      toast.success('Vendor access enabled — set up your passport and apply to markets')
      router.refresh()
    })
  }

  function enableCoordinatorAccess() {
    startTransition(async () => {
      const res = await fetch('/api/profile/enable-coordinator', { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as { error?: string }

      if (!res.ok) {
        toast.error(data.error ?? 'Could not enable organizer access')
        return
      }

      setLocalRole('coordinator')
      toast.success('Organizer access enabled — you can now review vendor applications')
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl border bg-white p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-foreground mb-1">Account access</h3>
        <p className="text-sm text-muted-foreground">{email}</p>
      </div>

      <div className="rounded-xl border bg-canvas px-4 py-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-harvest-100 text-harvest-800 capitalize">
            {roleDisplayLabel(localRole)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Portals: {portalLabelsText(portals)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{roleSummary(localRole)}</p>
        {localRole === 'coordinator' && ownedEventCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            You manage {ownedEventCount} market{ownedEventCount === 1 ? '' : 's'} on this account.
          </p>
        ) : null}
      </div>

      {(canEnableVendor || canEnableCoordinator) && localRole === 'shopper' ? (
        <div className="rounded-xl border border-harvest-200 bg-harvest-50 px-4 py-3 space-y-3">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-harvest-700" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-harvest-900">Upgrade this account</p>
              <p className="text-xs text-harvest-800 leading-relaxed">
                Patron accounts can enable vendor or organizer tools anytime. Booth approval only
                happens per market when the event is set to juried review.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEnableVendor ? (
              <Button size="sm" onClick={enableVendorAccess} disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enabling…
                  </>
                ) : (
                  'Enable vendor access'
                )}
              </Button>
            ) : null}
            {canEnableCoordinator ? (
              <Button size="sm" variant="outline" onClick={enableCoordinatorAccess} disabled={pending}>
                Enable organizer access
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {localRole === 'vendor' ? (
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
          Vendor accounts cannot self-upgrade to organizer. Contact support if you also need to create markets
          and review applications on this login.
        </div>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          What this account can do
        </p>
        <ul className="space-y-2">
          {capabilities.map(({ capability, enabled }) => (
            <li key={capability.id} className="flex items-start gap-2.5 text-sm">
              {enabled ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage-600" aria-hidden />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-stone-300" aria-hidden />
              )}
              <div className="min-w-0">
                {enabled && capability.href ? (
                  <Link href={capability.href} className="font-medium text-foreground hover:text-harvest-700 hover:underline">
                    {capability.label}
                  </Link>
                ) : (
                  <p className={`font-medium ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {capability.label}
                  </p>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed">{capability.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {portals.length > 1 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {portals.map((portal) => (
            <Link key={portal} href={getPortalHome(portal)}>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                Open {PORTAL_LABELS[portal]} portal
              </Button>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
