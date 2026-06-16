import Link from 'next/link'

export function MarketingSplitStory() {
  return (
    <section className="bg-cream px-4 py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-sage-100 via-canvas to-harvest-50 shadow-[var(--shadow-market-md)]">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(circle at 2px 2px, rgb(45 90 39 / 0.35) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
            aria-hidden
          />
          <div className="absolute inset-6 grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-forest/15 bg-white/60 backdrop-blur-sm"
                style={{ minHeight: i % 2 === 0 ? '4.5rem' : '3.5rem' }}
              />
            ))}
          </div>
          <p className="absolute bottom-6 left-6 right-6 rounded-xl bg-forest/90 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm">
            Booth layouts, vendor passports, and patron maps — connected in one platform.
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-harvest-700">Why Popup Hub</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Built by market people, not a generic events app
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            We organize and vend at weekend markets. Popup Hub replaces the email threads,
            spreadsheets, and DMs that eat your prep time — while giving shoppers a reason to plan
            ahead instead of showing up blind.
          </p>
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
              Organizers run applications, layouts, and market day from Blueprint Studio and Markets
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
