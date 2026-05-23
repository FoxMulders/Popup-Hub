import { Baby, Car, PawPrint, Accessibility } from 'lucide-react'
import type { Event } from '@/types/database'
import type { StrollerBadge } from '@/lib/shopper/layout'
import { PET_POLICY_LABELS } from '@/lib/shopper/layout'

interface GoodToKnowPanelProps {
  event: Event
  strollerBadge: StrollerBadge
}

export function GoodToKnowPanel({ event, strollerBadge }: GoodToKnowPanelProps) {
  const petPolicy = event.pet_policy ?? 'service_animals_only'
  const strollerLabel =
    strollerBadge === 'friendly'
      ? 'Stroller-friendly — walkways meet 8 ft minimum'
      : strollerBadge === 'caution'
        ? 'Some aisles may be narrow — allow extra time with strollers'
        : 'Layout not published yet'

  const rows = [
    event.parking_notes
      ? { icon: Car, label: 'Parking', text: event.parking_notes }
      : null,
    event.wheelchair_access_notes
      ? { icon: Accessibility, label: 'Accessibility', text: event.wheelchair_access_notes }
      : null,
    { icon: Baby, label: 'Stroller aisles', text: strollerLabel },
    { icon: PawPrint, label: 'Pet policy', text: PET_POLICY_LABELS[petPolicy] ?? petPolicy },
  ].filter(Boolean) as { icon: typeof Car; label: string; text: string }[]

  return (
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="font-heading text-lg font-semibold">Good to know</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Accessibility and logistics before you go
      </p>
      <ul className="mt-4 space-y-3">
        {rows.map(({ icon: Icon, label, text }) => (
          <li key={label} className="flex gap-3 text-sm">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-harvest-500" />
            <div>
              <p className="font-medium text-foreground">{label}</p>
              <p className="text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
