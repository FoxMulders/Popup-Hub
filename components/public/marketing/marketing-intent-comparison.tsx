'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import {
  COMPARE_INTENT_CTA,
  COMPARE_INTENT_HEADER,
  COMPARE_INTENT_OBJECTION,
  COMPARE_INTENT_PILLARS,
  type ComparisonChannel,
  type ComparisonPillar,
} from '@/lib/marketing/compare-intent'
import { COORDINATOR_ADVERTISE_SIGNUP_HREF } from '@/lib/marketing/home-hero'
import { cn } from '@/lib/utils'

interface ChannelRowProps {
  channel: ComparisonChannel
}

function ChannelRow({ channel }: ChannelRowProps) {
  const isPremium = channel.isPremium === true

  return (
    <article
      className={cn(
        'rounded-xl border p-4 transition-shadow',
        isPremium
          ? 'border-[#FF6B35]/40 bg-gradient-to-br from-[#FF6B35]/[0.08] via-white to-amber-50/60 shadow-sm ring-1 ring-[#FF6B35]/20'
          : 'border-stone-200/80 bg-stone-50/60'
      )}
    >
      <h4
        className={cn(
          'text-sm font-bold tracking-tight',
          isPremium ? 'text-[#FF6B35]' : 'text-espresso'
        )}
      >
        {channel.label}
      </h4>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{channel.body}</p>
    </article>
  )
}

interface PillarCardProps {
  pillar: ComparisonPillar
}

function PillarCard({ pillar }: PillarCardProps) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-stone-200/90 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold leading-snug tracking-tight text-espresso sm:text-xl">
        {pillar.title}
      </h3>
      <div className="mt-5 flex flex-1 flex-col gap-3">
        {pillar.channels.map((channel) => (
          <ChannelRow key={`${pillar.id}-${channel.id}`} channel={channel} />
        ))}
      </div>
    </article>
  )
}

interface ObjectionPanelProps {
  heading: string
  subCopy: string
  items: ReadonlyArray<{ id: string; label: string; body: string }>
  footerCallout: string
}

function ObjectionPanel({ heading, subCopy, items, footerCallout }: ObjectionPanelProps) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <section
      className="rounded-2xl bg-slate-900 p-8 text-white"
      aria-labelledby="objection-panel-heading"
    >
      <button
        type="button"
        id="objection-panel-heading"
        className="flex w-full items-start justify-between gap-4 text-left"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="text-xl font-bold leading-snug tracking-tight sm:text-2xl">{heading}</span>
        <ChevronDown
          className={cn(
            'mt-1 h-5 w-5 shrink-0 text-white/70 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
          aria-hidden
        />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-in-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">{subCopy}</p>

          <ul className="mt-6 space-y-4" role="list">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
              >
                <p className="font-semibold text-white">{item.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.body}</p>
              </li>
            ))}
          </ul>

          <p className="mt-6 rounded-xl border border-[#FF6B35]/30 bg-[#FF6B35]/10 px-5 py-4 text-sm font-semibold leading-relaxed text-[#FF6B35] sm:text-base">
            {footerCallout}
          </p>
        </div>
      </div>
    </section>
  )
}

interface FinalCtaBannerProps {
  title: string
  body: string
}

function FinalCtaBanner({ title, body }: FinalCtaBannerProps) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-[#FF6B35]/20 bg-gradient-to-br from-espresso via-slate-900 to-espresso p-8 text-white shadow-lg sm:p-10"
      aria-labelledby="final-cta-heading"
    >
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#FF6B35]/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[#FF6B35]/10 blur-3xl"
        aria-hidden
      />

      <div className="relative">
        <h2
          id="final-cta-heading"
          className="text-2xl font-extrabold uppercase leading-tight tracking-tight text-white sm:text-3xl"
        >
          {title}
        </h2>
        <p className="mt-5 max-w-4xl text-sm leading-relaxed text-slate-300 sm:text-base">{body}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={COORDINATOR_ADVERTISE_SIGNUP_HREF}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#FF6B35] px-7 text-sm font-bold text-white transition-colors hover:bg-[#e85f2f]"
          >
            Advertise your market
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/for-organizers"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Explore organizer tools
          </Link>
        </div>
      </div>
    </section>
  )
}

export function MarketingIntentComparison() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <header className="mx-auto max-w-4xl text-center">
        <p className="inline-flex items-center rounded-full border border-[#FF6B35]/30 bg-[#FF6B35]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#FF6B35]">
          Attention vs. impressions
        </p>
        <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-espresso sm:text-4xl lg:text-[2.5rem]">
          {COMPARE_INTENT_HEADER.title}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
          {COMPARE_INTENT_HEADER.subtitle}
        </p>
      </header>

      <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
        {COMPARE_INTENT_PILLARS.map((pillar) => (
          <PillarCard key={pillar.id} pillar={pillar} />
        ))}
      </div>

      <div className="mt-14">
        <ObjectionPanel
          heading={COMPARE_INTENT_OBJECTION.heading}
          subCopy={COMPARE_INTENT_OBJECTION.subCopy}
          items={COMPARE_INTENT_OBJECTION.items}
          footerCallout={COMPARE_INTENT_OBJECTION.footerCallout}
        />
      </div>

      <div className="mt-14">
        <FinalCtaBanner title={COMPARE_INTENT_CTA.title} body={COMPARE_INTENT_CTA.body} />
      </div>
    </div>
  )
}
