'use client'

import { useContext, type MouseEvent, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { requestPopupLoaderAnimation } from '@/lib/brand/popup-loader-play'
import { PopupLoaderContext } from '@/components/brand/popup-loader-context'

const LOGO_VERSION =
  process.env.NEXT_PUBLIC_BUILD_NUMBER ??
  process.env.NEXT_PUBLIC_BUILD_COMMIT ??
  '1'
const LOGO_SRC = `/popup-hub-brand.png?v=${LOGO_VERSION}`
const ICON_SRC = `/popup-hub-icon.png?v=${LOGO_VERSION}`
const LOGO_WIDTH = 1024
const LOGO_HEIGHT = 559
const ICON_SIZE = 512

interface PopupHubLogoProps {
  className?: string
  title?: string
  priority?: boolean
  /** When set, the logo navigates instead of playing the market animation. */
  href?: string
}

function playAnimation(event: MouseEvent, playRandomLoader?: () => void) {
  event.preventDefault()
  event.stopPropagation()
  if (playRandomLoader) {
    playRandomLoader()
    return
  }
  requestPopupLoaderAnimation()
}

function LogoAnimationButton({
  className,
  title,
  children,
}: {
  className?: string
  title: string
  children: ReactNode
}) {
  const loader = useContext(PopupLoaderContext)

  return (
    <button
      type="button"
      onClick={(event) => playAnimation(event, loader?.playRandomLoader)}
      className={cn(
        'relative z-10 inline-flex min-h-11 min-w-[7rem] cursor-pointer touch-manipulation items-center justify-center rounded-md border-0 bg-transparent p-1 transition-opacity hover:opacity-90 active:scale-[0.98]',
        className,
      )}
      aria-label={`${title} — play market animation`}
    >
      {children}
    </button>
  )
}

function LogoShell({
  className,
  title,
  href,
  children,
}: {
  className?: string
  title: string
  href?: string
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
    <LogoAnimationButton className={className} title={title}>
      {children}
    </LogoAnimationButton>
  )
}

export function PopupHubLogo({
  className,
  title = 'Popup Hub',
  priority = false,
  href,
}: PopupHubLogoProps) {
  const image = (
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
    <LogoShell className={className} title={title} href={href}>
      {image}
    </LogoShell>
  )
}

export function PopupHubIcon({
  className,
  title = 'Popup Hub',
  priority = false,
  href,
}: PopupHubLogoProps) {
  const image = (
    <Image
      src={ICON_SRC}
      alt={title}
      width={ICON_SIZE}
      height={ICON_SIZE}
      unoptimized
      draggable={false}
      className="pointer-events-none h-auto w-auto select-none bg-transparent object-contain"
      priority={priority}
    />
  )

  return (
    <LogoShell className={className} title={title} href={href}>
      {image}
    </LogoShell>
  )
}

type BrandLogoMarkSize = 'nav' | 'auth'

const MARK_HEIGHTS: Record<BrandLogoMarkSize, string> = {
  nav: 'h-18 w-auto sm:h-20',
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
