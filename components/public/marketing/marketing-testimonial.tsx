export function MarketingTestimonial() {
  return (
    <section className="border-y border-stone-200/60 bg-sage-50/50 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-sage-700">From the community</p>
        <blockquote className="mt-6">
          <p className="text-lg font-medium leading-relaxed text-foreground sm:text-xl">
            &ldquo;Having vendor lineups and booth maps in one place means our regulars plan their
            route before they arrive — and new vendors actually find us through discovery.&rdquo;
          </p>
        </blockquote>
        <footer className="mt-6 text-sm text-muted-foreground">
          <cite className="not-italic font-semibold text-foreground">Weekend market coordinator</cite>
          <span className="mx-2 text-stone-300" aria-hidden>
            ·
          </span>
          <span>Alberta pop-up market</span>
        </footer>
      </div>
    </section>
  )
}
