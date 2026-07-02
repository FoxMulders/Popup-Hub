import { fomoTooltips } from './fomo-tooltips'
import { ClipboardList, CreditCard, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

const FEATURE_CARDS = [
  {
    id: 'vendor_inbox' as const,
    title: 'Vendor intake inbox',
    description: 'Certified vendors apply directly — no spreadsheet chasing.',
    icon: ClipboardList,
    accent: 'text-emerald-700 bg-emerald-50',
  },
  {
    id: 'map_builder' as const,
    title: 'HubGrid map builder',
    description: 'Draw booths, enforce clearance, and sync the allocation ledger.',
    icon: LayoutGrid,
    accent: 'text-sky-800 bg-sky-50',
  },
  {
    id: 'invoicing_ledger' as const,
    title: 'Payments & ledger',
    description: 'Automated booth fees, splits, and payout tracking.',
    icon: CreditCard,
    accent: 'text-amber-800 bg-amber-50',
  },
] as const

interface FomoFeatureCardsProps {
  className?: string
  compact?: boolean
}

export function FomoFeatureCards({ className, compact = false }: FomoFeatureCardsProps) {
  return (
    <div
      className={cn(
        'grid gap-3',
        compact ? 'grid-cols-1' : 'sm:grid-cols-3',
        className
      )}
    >
      {FEATURE_CARDS.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.id}
            className="group relative rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm transition hover:border-forest/25 hover:shadow-md"
          >
            <div
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-lg',
                card.accent
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">{card.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{card.description}</p>
            <p className="pointer-events-none absolute inset-x-3 bottom-full mb-2 hidden rounded-lg border border-gray-200 bg-white p-2 text-[11px] leading-snug text-gray-700 opacity-0 shadow-md transition group-hover:block group-hover:opacity-100 sm:block">
              {fomoTooltips[card.id]}
            </p>
          </div>
        )
      })}
    </div>
  )
}
