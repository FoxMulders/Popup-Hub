/** Soft ambient blobs — consistent site-wide atmosphere behind page content. */
export function SiteAmbientBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-sage-200/35 blur-3xl" />
      <div className="absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-harvest-100/40 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-forest/5 blur-3xl" />
    </div>
  )
}
