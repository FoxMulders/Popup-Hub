import { PORTAL_LABELS, type ActivePortal } from '@/lib/portals/active-portal'
import { cn } from '@/lib/utils'

interface PortalRoleBadgeProps {
  portal: ActivePortal
  className?: string
}

/** Shared portal label styling used across patron, vendor, and coordinator chrome. */
export function PortalRoleBadge({ portal, className }: PortalRoleBadgeProps) {
  return (
    <p
      className={cn(
        'text-[10px] font-black uppercase tracking-widest text-muted-foreground',
        className
      )}
    >
      {PORTAL_LABELS[portal]}
    </p>
  )
}
