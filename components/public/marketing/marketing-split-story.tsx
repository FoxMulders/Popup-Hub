import Link from 'next/link'
import { ClipboardCheck, LayoutGrid, MapPin, Store, Users, Wallet } from 'lucide-react'
import { HOME_ORIGIN_STORY } from '@/lib/marketing/origin-story'

const PLATFORM_TILES = [
  {
    icon: MapPin,
    label: 'Discover',
    detail: 'Patrons browse markets & maps',
    className: 'bg-sage-100/90 text-sage-800',
  },
  {
    icon: Store,
    label: 'Passport',
    detail: 'Vendors apply with one profile',
    className: 'bg-harvest-100/90 text-harvest-800',
  },
  {
    icon: LayoutGrid,
    label: 'Layout',
    detail: 'Organizers plan booth grids',
    className: 'bg-forest/10 text-forest',
  },
  {
    icon: ClipboardCheck,
    label: 'Applications',
    detail: 'Review & approve vendors',
    className: 'bg-sage-50 text-sage-700',
  },
  {
    icon: Users,
    label: 'Check-in',
    detail: 'Market day on the ground',
    className: 'bg-canvas text-foreground',
  },
  {
    icon: Wallet,
    label: 'Payouts',
    detail: 'Booth fees in one flow',
    className: 'bg-harvest-50 text-harvest-700',
  },
] as const

export function MarketingSplitStory() {
  return (
    <section className="bg-cream px-4 py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-sage-100 via-canvas to-harvest-50 shadow-[var(--shadow-market-md)]">
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                'radial-gradient(circle at 2px 2px, rgb(45 90 39 / 0.35) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
            aria-hidden
          />
          <div className="absolute inset-5 flex flex-col justify-center gap-3 sm:inset-6 sm:gap-4">
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {PLATFORM_TILES.slice(0, 3).map(({ icon: Icon, label, detail, className }) => (
                <div
                  key={label}
                  className={`flex flex-col items-center justify-center rounded-xl border border-white/60 px-1 py-3 text-center shadow-sm backdrop-blur-sm sm:px-2 sm:py-4 ${className}`}
                >
                  <Icon className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
                  <span className="mt-1.5 text-[10px] font-bold uppercase tracking-wide sm:text-[11px]">
                    {label}
                  </span>
                  <span className="mt-0.5 hidden text-[9px] leading-tight opacity-80 sm:block">
                    {detail}
                  </span>
                </div>
              ))}
            </div>
            <p className="rounded-xl bg-forest/90 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm">
              Booth layouts, vendor passports, and patron maps — connected in one platform.
            </p>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {PLATFORM_TILES.slice(3).map(({ icon: Icon, label, detail, className }) => (
                <div
                  key={label}
                  className={`flex flex-col items-center justify-center rounded-xl border border-white/60 px-1 py-3 text-center shadow-sm backdrop-blur-sm sm:px-2 sm:py-4 ${className}`}
                >
                  <Icon className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
                  <span className="mt-1.5 text-[10px] font-bold uppercase tracking-wide sm:text-[11px]">
                    {label}
                  </span>
                  <span className="mt-0.5 hidden text-[9px] leading-tight opacity-80 sm:block">
                    {detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-harvest-700">
            {HOME_ORIGIN_STORY.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {HOME_ORIGIN_STORY.headline}
          </h2>
          {HOME_ORIGIN_STORY.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {paragraph}
            </p>
          ))}
          <p className="mt-4 text-sm font-medium text-foreground sm:text-base">{HOME_ORIGIN_STORY.tagline}</p>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest" aria-hidden />
              Shoppers see confirmed vendors before they leave home
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest" aria-hidden />
              Vendors apply once with a passport, not a new PDF every week
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest" aria-hidden />
              Organizers run applications, layouts, and market day from one dashboard
            </li>
          </ul>
          <Link
            href="/legal/about"
            className="mt-8 inline-flex text-sm font-semibold text-forest hover:underline"
          >
            Read our story →
          </Link>
        </div>
      </div>
    </section>
  )
}
