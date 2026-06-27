'use client'

import { useCallback, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { PopupLoaderScene } from '@/components/brand/popup-loader-scene'
import { pickRandomLoaderVariant, type LoaderVariantId } from '@/lib/brand/loader-variants'
import { BRAND_LOGO, BRAND_WORDMARK, brandWordmarkSrc } from '@/lib/brand/brand-logo-paths'
import { useBrandLogoSrc } from '@/hooks/use-brand-logo-src'

/** Square storefront icon (stall + pin) — no wordmark text. */
const LOGO_WIDTH = BRAND_LOGO.width
const LOGO_HEIGHT = BRAND_LOGO.height

interface PopupHubLogoProps {
  className?: string
  title?: string
  priority?: boolean
  /** Footer icon at ~1″ tall with a comfortable tap target. */
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
        // breathe past the static button rectangle so the tent peak
        // is never cut off by the rounded button shell. The SVG
        // itself uses `preserveAspectRatio` to stay centred and
        // proportional, so visually it still reads as contained.
        'relative z-10 inline-flex cursor-pointer touch-manipulation items-center justify-center rounded-md border-0 bg-transparent transition-opacity hover:opacity-90 active:scale-[0.98]',
        compact ? 'min-h-11 min-w-11 p-0' : 'min-h-11 min-w-[7rem] p-0',
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

/** Footer icon — physical 1″ height for consistent cross-browser sizing. */
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
  const logoSrc = useBrandLogoSrc()

  const image = compact ? (
    // Plain img avoids Next/Image intrinsic-size fights in Firefox/Edge.
    <img
      src={logoSrc}
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
      src={logoSrc}
      alt={title}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      unoptimized
      draggable={false}
      className="pointer-events-none h-full w-full max-h-full max-w-full select-none bg-transparent object-contain"
      priority={priority}
    />
  )

  return (
    <LogoShell className={className} title={title} href={href} compact={compact}>
      {image}
    </LogoShell>
  )
}

/** @deprecated Use PopupHubLogo / BrandLogoLockup — storefront icon only. */
export function PopupHubIcon(props: PopupHubLogoProps) {
  return <PopupHubLogo {...props} />
}

type BrandLogoMarkSize = 'nav' | 'auth' | 'header' | 'rail'

const MARK_HEIGHTS: Record<BrandLogoMarkSize, string> = {
  /** Legacy marketing lockup — avoid in sticky app chrome. */
  nav: 'h-[5.5rem] w-auto sm:h-[6.2rem]',
  auth: 'h-14 w-auto sm:h-16',
  /** Single-row sticky header: logo beside portal tabs. */
  header: 'h-9 w-auto sm:h-10',
  /** Slim icon rail (HubGrid nav dock). */
  rail: 'h-7 w-7 min-h-0 min-w-7 sm:h-7',
}

interface BrandLogoMarkProps {
  size?: BrandLogoMarkSize
  className?: string
  href?: string
}

/** Horizontal "PopupHub" wordmark for sticky header chrome. */
export function BrandLogoLockup({
  className,
  href,
  size = 'header',
}: {
  className?: string
  href?: string
  size?: BrandLogoMarkSize
}) {
  const wordmark = (
    <Image
      src={brandWordmarkSrc()}
      alt="Popup Hub"
      width={BRAND_WORDMARK.width}
      height={BRAND_WORDMARK.height}
      unoptimized
      priority
      draggable={false}
      className={cn(
        'pointer-events-none w-auto max-w-full select-none object-contain object-left',
        MARK_HEIGHTS[size],
        className,
      )}
    />
  )

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex shrink-0 items-center rounded-md"
        aria-label="Popup Hub"
      >
        {wordmark}
      </Link>
    )
  }

  return wordmark
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
