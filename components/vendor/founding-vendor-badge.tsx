import { cn } from '@/lib/utils'

interface FoundingVendorBadgeProps {
  className?: string
}

export function FoundingVendorBadge({ className }: FoundingVendorBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-harvest-200 bg-harvest-50 px-2 py-0.5 text-xs font-medium text-harvest-700',
        className
      )}
    >
      ✨ Founding Vendor
    </span>
  )
}
