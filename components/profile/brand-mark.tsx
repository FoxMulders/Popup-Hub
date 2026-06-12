'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { resolveAnyPublicAssetUrl } from '@/lib/storage/public-url'

const SIZE_STYLES = {
  nav: 'h-9 w-9 min-h-9 min-w-9',
  sm: 'h-10 w-10 min-h-10 min-w-10',
  md: 'h-14 w-14 min-h-14 min-w-14',
  profile: 'h-24 w-24 min-h-24 min-w-24 sm:h-28 sm:w-28 sm:min-h-28 sm:min-w-28',
} as const

export type BrandMarkSize = keyof typeof SIZE_STYLES

interface BrandMarkProps {
  src?: string | null
  alt: string
  fallback?: string
  size?: BrandMarkSize
  className?: string
}

/** Shows a full business logo without circular cropping. */
export function BrandMark({
  src,
  alt,
  fallback = '?',
  size = 'md',
  className,
}: BrandMarkProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const resolvedSrc = resolveAnyPublicAssetUrl(src)

  const frameClass = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white p-1',
    SIZE_STYLES[size],
    className
  )

  if (resolvedSrc && !imageFailed) {
    return (
      <div className={frameClass}>
        <img
          src={resolvedSrc}
          alt={alt}
          className="block h-full w-full object-contain object-center"
          onError={() => setImageFailed(true)}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(frameClass, 'bg-harvest-100 text-harvest-700 font-bold text-xs')}
      aria-hidden={!fallback}
    >
      {fallback.slice(0, 2).toUpperCase()}
    </div>
  )
}
