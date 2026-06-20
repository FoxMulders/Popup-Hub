import Link from 'next/link'
import { CalendarDays, CreditCard, LayoutGrid, Rocket } from 'lucide-react'
import { DemoMarketLauncher } from '@/components/coordinator/demo-market-launcher'
import { COORDINATOR_SIGNUP_HREF } from '@/lib/marketing/home-hero'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    title: 'Create your first market',
    detail: 'Dates, venue pin, booth fees, and application settings in the setup wizard.',
    estimate: '~15 min',
    href: '/coordinator/events/new',
    icon: CalendarDays,
  },
  {
    title: 'Connect booth payouts',
    detail: 'Link Square or Stripe for card payments — or add your organization name to publish with offline fees.',
    estimate: '~5 min',
    href: '/coordinator/payment-methods',
    icon: CreditCard,
  },
  {
    title: 'Place booths on HubGrid',
    detail: 'Draw your floor plan or start from a blank canvas, then assign vendors.',
    estimate: '~10 min',
    href: '/coordinator/studio',
    icon: LayoutGrid,
  },
  {
    title: 'Publish for patron discovery',
    detail: 'When your lineup is ready, publish so shoppers and vendors find you on Popup Hub.',
    estimate: '~2 min',
    href: '/coordinator/markets',
    icon: Rocket,
  },
] as const

export function CoordinatorGettingStarted({ className }: { className?: string }) {
  return (
    <section
      className={cn('marketing-glass-card space-y-4 p-6', className)}
      aria-labelledby="coordinator-getting-started"
    >
      <div>
        <h2 id="coordinator-getting-started" className="text-lg font-bold text-foreground">
          Getting started checklist
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          New here? Work through these steps to publish your first makers market.
        </p>
      </div>
      <ol className="space-y-3">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          return (
            <li key={step.title}>
              <Link
                href={step.href}
                className="group flex gap-3 rounded-xl border border-stone-200/80 bg-card/80 p-4 transition-colors hover:border-forest/30 hover:bg-canvas/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest/10 text-sm font-bold text-forest">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-forest">
                    <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                    {step.title}
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {step.estimate}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {step.detail}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <DemoMarketLauncher size="sm" />
        <span className="text-xs text-muted-foreground">
          Pre-filled draft — place booths on HubGrid in about 10 minutes.
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Prefer a guided start?{' '}
        <Link href={COORDINATOR_SIGNUP_HREF} className="font-medium text-forest hover:underline">
          Open the market setup wizard
        </Link>
        .
      </p>
    </section>
  )
}
