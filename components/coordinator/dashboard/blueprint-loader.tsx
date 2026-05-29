'use client'

import { cn } from '@/lib/utils'

export interface BlueprintLoaderProps {
  className?: string
  /** Skip stroke-draw animation (reduced motion or instant handoff) */
  instant?: boolean
}

/**
 * Inline SVG market grid for LCP-friendly blueprint draw before CAD canvas mounts.
 */
export function BlueprintLoader({ className, instant = false }: BlueprintLoaderProps) {
  return (
    <svg
      className={cn(
        'dashboard-blueprint h-full w-full max-h-full max-w-full text-emerald-800/90',
        instant && 'dashboard-blueprint--instant',
        className
      )}
      viewBox="0 0 480 360"
      role="img"
      aria-label="Loading market floor plan blueprint"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id="dashboard-blueprint-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path
            d="M 24 0 L 0 0 0 24"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="0.75"
          />
        </pattern>
      </defs>
      <rect width="480" height="360" fill="url(#dashboard-blueprint-grid)" />
      <g
        className="dashboard-blueprint__strokes"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect className="dashboard-blueprint__stroke" x="32" y="28" width="416" height="304" rx="8" />
        <path
          className="dashboard-blueprint__stroke"
          d="M 120 28 L 120 332 M 240 28 L 240 332 M 360 28 L 360 332"
        />
        <path
          className="dashboard-blueprint__stroke"
          d="M 32 120 L 448 120 M 32 220 L 448 220"
        />
        <rect className="dashboard-blueprint__stroke" x="48" y="44" width="56" height="40" rx="4" />
        <rect className="dashboard-blueprint__stroke" x="136" y="44" width="56" height="40" rx="4" />
        <rect className="dashboard-blueprint__stroke" x="256" y="44" width="56" height="40" rx="4" />
        <rect className="dashboard-blueprint__stroke" x="376" y="44" width="56" height="40" rx="4" />
        <rect className="dashboard-blueprint__stroke" x="48" y="136" width="56" height="40" rx="4" />
        <rect className="dashboard-blueprint__stroke" x="256" y="136" width="120" height="72" rx="6" />
        <rect className="dashboard-blueprint__stroke" x="48" y="236" width="56" height="40" rx="4" />
        <rect className="dashboard-blueprint__stroke" x="136" y="236" width="56" height="40" rx="4" />
        <rect className="dashboard-blueprint__stroke" x="376" y="236" width="56" height="40" rx="4" />
        <circle className="dashboard-blueprint__stroke" cx="240" cy="172" r="18" />
        <path
          className="dashboard-blueprint__stroke dashboard-blueprint__stroke--accent"
          d="M 200 300 Q 240 268 280 300"
          strokeWidth="2"
        />
      </g>
    </svg>
  )
}
