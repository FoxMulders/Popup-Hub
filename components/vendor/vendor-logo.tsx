'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { resolvePublicAssetUrl } from '@/lib/storage/public-url'

/** Max display bounds — width grows with the logo's natural aspect ratio. */
const SIZE_CLASSES = {
  xs: 'max-h-8 max-w-[5rem]',
  sm: 'max-h-10 max-w-[6.5rem]',
  md: 'max-h-12 max-w-[8.5rem]',
  lg: 'max-h-16 max-w-[11rem]',
  xl: 'max-h-32 max-w-full',
  profile: 'max-h-20 max-w-[14rem]',
} as const

const FALLBACK_MIN = {
  xs: 'min-h-8 min-w-[2rem]',
  sm: 'min-h-10 min-w-[2.5rem]',
  md: 'min-h-12 min-w-[3rem]',
  lg: 'min-h-16 min-w-[4rem]',
  xl: 'min-h-24 min-w-[6rem]',
  profile: 'min-h-20 min-w-[5rem]',
} as const

export type VendorLogoSize = keyof typeof SIZE_CLASSES

interface VendorLogoProps {
  src?: string | null
  alt: string
  fallback?: string
  size?: VendorLogoSize
  className?: string
}

export function VendorLogo({
  src,
  alt,
  fallback = '?',
  size = 'sm',
  className,
}: VendorLogoProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const resolvedSrc = resolvePublicAssetUrl(src)
  const frameClass = cn(
    'inline-flex min-h-0 min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-white p-1.5',
    SIZE_CLASSES[size],
    FALLBACK_MIN[size],
    className
  )

  if (resolvedSrc && !imageFailed) {
    return (
      <div className={frameClass}>
        <img
          src={resolvedSrc}
          alt={alt}
          className="block max-h-full w-auto max-w-full object-contain object-center"
          onError={() => setImageFailed(true)}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        frameClass,
        'bg-harvest-100 text-harvest-700 font-bold text-xs'
      )}
      aria-hidden={!fallback}
    >
      {fallback.slice(0, 2).toUpperCase()}
    </div>
  )
}
