'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { resolvePublicAssetUrl } from '@/lib/storage/public-url'

const SIZE_CLASSES = {
  xs: 'h-8 w-16',
  sm: 'h-10 w-20',
  md: 'h-12 w-28',
  lg: 'h-16 w-36',
  xl: 'h-24 w-40',
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
    'box-border flex min-h-0 min-w-0 shrink items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-white p-1',
    SIZE_CLASSES[size],
    'max-w-full',
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
      className={cn(
        frameClass,
        'bg-amber-100 text-amber-800 font-bold text-xs'
      )}
      aria-hidden={!fallback}
    >
      {fallback.slice(0, 2).toUpperCase()}
    </div>
  )
}
