'use client'

import { useCallback, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { PopupLoaderScene } from '@/components/brand/popup-loader-scene'
import { pickRandomLoaderVariant, type LoaderVariantId } from '@/lib/brand/loader-variants'

const LOGO_VERSION =
  process.env.NEXT_PUBLIC_BUILD_NUMBER ??
  process.env.NEXT_PUBLIC_GIT_HASH ??
  process.env.NEXT_PUBLIC_BUILD_COMMIT ??
  '1'
const LOGO_SRC = `/popup-hub-brand.png?v=${LOGO_VERSION}`
const LOGO_WIDTH = 994
const LOGO_HEIGHT = 1024

interface PopupHubLogoProps {
  className?: string
  title?: string
  priority?: boolean
  /** Footer wordmark at ~1″ tall with a comfortable tap target. */
  compact?: boolean
  /** When set, the logo navigates instead of playing the market animation. */
  href?: string
}

function LogoAnimationButton({
  className,
  title,
  compact = false,
  children,
}: {
  className?: string
  title: string
  compact?: boolean
  children: ReactNode
}) {
  const [activeVariant, setActiveVariant] = useState<LoaderVariantId | null>(null)

  const handleClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (typeof window !== 'undefined') {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reducedMotion) return
    }
    setActiveVariant((current) =>
      current ? current : pickRandomLoaderVariant({ forReplay: true })
    )
  }, [])

  const handleSceneEnd = useCallback(() => {
    setActiveVariant(null)
  }, [])

  const playing = activeVariant != null

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        // We deliberately *do not* set `overflow-hidden` here.
        // The inline replay scene mounts an SVG whose content
        // (market tent peak, wordmark) needs to be allowed to
        // breathe past the static button rectangle so the peak
        // is never cut off by the rounded button shell. The SVG
        // itself uses `preserveAspectRatio` to stay centred and
        // proportional, so visually it still reads as contained.
        'relative z-10 inline-flex cursor-pointer touch-manipulation items-center justify-center rounded-md border-0 bg-transparent transition-opacity hover:opacity-90 active:scale-[0.98]',
        compact ? 'min-h-11 min-w-11 p-1.5' : 'min-h-11 min-w-[7rem] p-1',
        className,
      )}
      aria-label={`${title} — play market animation`}
      aria-pressed={playing}
    >
      <span
        aria-hidden={playing}
        className={cn(
          'inline-flex items-center justify-center transition-opacity duration-200',
          playing ? 'opacity-0' : 'opacity-100'
        )}
      >
        {children}
      </span>
      {playing ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible"
        >
          <PopupLoaderScene
            key={activeVariant}
            variantId={activeVariant!}
            mode="replay"
            onReadyToDismiss={handleSceneEnd}
          />
        </span>
      ) : null}
    </button>
  )
}

function LogoShell({
  className,
  title,
  href,
  compact = false,
  children,
}: {
  className?: string
  title: string
  href?: string
  compact?: boolean
  children: ReactNode
}) {
  if (href) {
    return (
      <Link href={href} className={cn('inline-flex shrink-0 rounded-md', className)} aria-label={title}>
        {children}
      </Link>
    )
  }

  return (
    <LogoAnimationButton className={className} title={title} compact={compact}>
      {children}
    </LogoAnimationButton>
  )
}

/** Footer wordmark — physical 1″ height for consistent cross-browser sizing. */
const FOOTER_LOGO_HEIGHT_IN = 0.67
const FOOTER_LOGO_DISPLAY_HEIGHT_PX = 96
const FOOTER_LOGO_DISPLAY_WIDTH_PX = Math.round(
  FOOTER_LOGO_DISPLAY_HEIGHT_PX * (LOGO_WIDTH / LOGO_HEIGHT),
)

export function PopupHubLogo({
  className,
  title = 'Popup Hub',
  priority = false,
  compact = false,
  href,
}: PopupHubLogoProps) {
  const image = compact ? (
    // Plain img avoids Next/Image intrinsic-size fights in Firefox/Edge.
    <img
      src={LOGO_SRC}
      alt={title}
      width={FOOTER_LOGO_DISPLAY_WIDTH_PX}
      height={FOOTER_LOGO_DISPLAY_HEIGHT_PX}
      draggable={false}
      decoding="async"
      style={{
        display: 'block',
        height: `${FOOTER_LOGO_HEIGHT_IN}in`,
        width: 'auto',
        maxHeight: `${FOOTER_LOGO_HEIGHT_IN}in`,
      }}
      className="pointer-events-none max-w-none select-none object-contain object-center"
    />
  ) : (
    <Image
      src={LOGO_SRC}
      alt={title}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      unoptimized
      draggable={false}
      className="pointer-events-none h-auto w-auto select-none bg-transparent object-contain"
      priority={priority}
    />
  )

  return (
    <LogoShell className={className} title={title} href={href} compact={compact}>
      {image}
    </LogoShell>
  )
}

/** @deprecated Use PopupHubLogo / BrandLogoLockup — full wordmark only. */
export function PopupHubIcon(props: PopupHubLogoProps) {
  return <PopupHubLogo {...props} />
}

type BrandLogoMarkSize = 'nav' | 'auth'

const MARK_HEIGHTS: Record<BrandLogoMarkSize, string> = {
  nav: 'h-[5.175rem] w-auto sm:h-[5.75rem]',
  auth: 'h-40 w-auto sm:h-48',
}

interface BrandLogoMarkProps {
  size?: BrandLogoMarkSize
  className?: string
  href?: string
}

/** Full wordmark for nav headers and auth screens. */
export function BrandLogoLockup({
  className,
  href,
}: {
  className?: string
  href?: string
}) {
  return (
    <PopupHubLogo
      className={cn(MARK_HEIGHTS.nav, className)}
      title="Popup Hub"
      priority
      href={href}
    />
  )
}

export function BrandLogoMark({ size = 'nav', className, href }: BrandLogoMarkProps) {
  return (
    <PopupHubLogo
      className={cn(MARK_HEIGHTS[size], className)}
      title="Popup Hub"
      priority={size === 'auth'}
      href={href}
    />
  )
}
