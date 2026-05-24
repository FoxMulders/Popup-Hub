import Image from 'next/image'
import { cn } from '@/lib/utils'

const LOGO_VERSION = process.env.NEXT_PUBLIC_BUILD_COMMIT ?? '1'
/** Direct public path — avoids stale _next/image optimization cache */
const LOGO_SRC = `/popup-hub-brand.png?v=${LOGO_VERSION}`
const ICON_SRC = `/popup-hub-icon.png?v=${LOGO_VERSION}`
const LOGO_WIDTH = 1024
const LOGO_HEIGHT = 559
const ICON_SIZE = 512

interface PopupHubLogoProps {
  className?: string
  /** Accessible label; defaults to "Popup Hub". */
  title?: string
  priority?: boolean
}

export function PopupHubLogo({
  className,
  title = 'Popup Hub',
  priority = false,
}: PopupHubLogoProps) {
  return (
    <Image
      src={LOGO_SRC}
      alt={title}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      unoptimized
      className={cn('h-auto w-auto bg-transparent object-contain', className)}
      priority={priority}
    />
  )
}

/** Square icon mark (stall + pin) for compact UI slots. */
export function PopupHubIcon({
  className,
  title = 'Popup Hub',
  priority = false,
}: PopupHubLogoProps) {
  return (
    <Image
      src={ICON_SRC}
      alt={title}
      width={ICON_SIZE}
      height={ICON_SIZE}
      unoptimized
      className={cn('h-auto w-auto bg-transparent object-contain', className)}
      priority={priority}
    />
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
}

/** Full wordmark for nav headers and auth screens. */
export function BrandLogoLockup({ className }: { className?: string }) {
  return (
    <PopupHubLogo
      className={cn(MARK_HEIGHTS.nav, className)}
      title="Popup Hub"
      priority
    />
  )
}

export function BrandLogoMark({ size = 'nav', className }: BrandLogoMarkProps) {
  return (
    <PopupHubLogo
      className={cn(MARK_HEIGHTS[size], className)}
      title="Popup Hub"
      priority={size === 'auth'}
    />
  )
}
