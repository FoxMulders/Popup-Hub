/** Abstract booth-grid pattern — unique Popup Hub hero texture (not stock photography). */
export function MarketingHeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.14]"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="booth-grid" width="56" height="56" patternUnits="userSpaceOnUse">
            <rect width="56" height="56" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6" />
            <rect x="8" y="8" width="40" height="28" rx="2" fill="white" opacity="0.08" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#booth-grid)" />
      </svg>
      <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-harvest-400/20 blur-3xl" />
      <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-sage-300/25 blur-3xl" />
    </div>
  )
}
