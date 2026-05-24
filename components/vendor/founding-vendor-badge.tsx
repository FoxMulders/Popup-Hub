import { cn } from '@/lib/utils'

interface FoundingVendorBadgeProps {
  className?: string
}

export function FoundingVendorBadge({ className }: FoundingVendorBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700',
        className
      )}
    >
      ✨ Founding Vendor
    </span>
  )
}
