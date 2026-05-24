import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { UserRound } from 'lucide-react'

export interface MarketOwnerSummary {
  id: string
  full_name: string
  avatar_url?: string | null
}

interface MarketOwnerLinkProps {
  owner: MarketOwnerSummary
  className?: string
  compact?: boolean
}

function ownerInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function MarketOwnerLink({ owner, className = '', compact = false }: MarketOwnerLinkProps) {
  const initials = ownerInitials(owner.full_name)

  return (
    <Link
      href={`/coordinators/${owner.id}`}
      className={`group inline-flex max-w-full items-center gap-2 rounded-lg border border-transparent px-1 py-0.5 transition-colors hover:border-stone-200 hover:bg-canvas ${className}`}
    >
      <Avatar className={compact ? 'h-6 w-6' : 'h-8 w-8'}>
        <AvatarImage src={owner.avatar_url ?? undefined} alt="" />
        <AvatarFallback className="bg-harvest-100 text-[10px] font-semibold text-harvest-800">
          {initials || <UserRound className="h-3.5 w-3.5" />}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Market owner
        </span>
        <span className={`block truncate font-medium text-foreground group-hover:text-harvest-700 group-hover:underline ${compact ? 'text-xs' : 'text-sm'}`}>
          {owner.full_name}
        </span>
      </span>
    </Link>
  )
}

export function vendorApplicationStatusHref(eventId: string): string {
  return `/vendor/events/${eventId}#your-application`
}
