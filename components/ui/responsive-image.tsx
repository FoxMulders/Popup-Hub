import Image, { type ImageProps } from 'next/image'
import { cn } from '@/lib/utils'

type ResponsiveImageProps = Omit<ImageProps, 'loading'> & {
  /** When true, image loads eagerly (hero / LCP). Default lazy. */
  priority?: boolean
  /** Optional fixed aspect ratio wrapper to reserve space and reduce CLS. */
  aspectRatio?: `${number}/${number}`
}

/**
 * Optimized image wrapper — prefers next/image with lazy loading,
 * responsive sizes, and optional aspect-ratio box for layout stability.
 */
export function ResponsiveImage({
  className,
  priority = false,
  aspectRatio,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  alt,
  ...props
}: ResponsiveImageProps) {
  const image = (
    <Image
      {...props}
      alt={alt}
      sizes={sizes}
      loading={priority ? undefined : 'lazy'}
      priority={priority}
      className={cn('h-auto max-w-full object-cover', className)}
    />
  )

  if (!aspectRatio) return image

  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio }}>
      {image}
    </div>
  )
}

/** Remote or blob URLs that next/image cannot optimize — falls back to native img with lazy loading. */
export function ResponsiveNativeImage({
  src,
  alt,
  className,
  aspectRatio,
  priority = false,
}: {
  src: string
  alt: string
  className?: string
  aspectRatio?: `${number}/${number}`
  priority?: boolean
}) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('h-auto max-w-full object-cover', className)}
    />
  )

  if (!aspectRatio) return img

  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio }}>
      {img}
    </div>
  )
}
