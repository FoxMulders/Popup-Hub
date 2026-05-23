/** Minimal market stall SVG — raw bounding lines only for fast canvas paint at small zoom. */
export function MarketStallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 16" className={className} aria-hidden focusable="false">
      <rect x="1" y="6" width="18" height="9" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <polyline
        points="1,6 10,1 19,6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="miter"
      />
      <line x1="10" y1="6" x2="10" y2="15" stroke="currentColor" strokeWidth="0.8" opacity="0.55" />
    </svg>
  )
}
