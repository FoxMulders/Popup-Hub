import Image from 'next/image'
import { cn } from '@/lib/utils'
import {
  POPUP_FUNDS_LOGO,
  POPUP_FUNDS_WORDMARK,
  popupFundsLogoSrc,
  popupFundsWordmarkSrc,
} from '@/lib/brand/popup-funds-paths'

type PopupFundsWordmarkSize = 'default' | 'wallet' | 'nav'

const WORDMARK_HEIGHTS: Record<PopupFundsWordmarkSize, string> = {
  default: 'h-10 w-auto max-w-full sm:h-12',
  wallet: 'h-14 w-auto max-w-full sm:h-16 md:h-[4.5rem]',
  nav: 'h-9 w-auto max-w-[11rem] sm:h-10',
}

export function PopupFundsWordmark({
  className,
  priority = false,
  size = 'default',
}: {
  className?: string
  priority?: boolean
  size?: PopupFundsWordmarkSize
}) {
  return (
    <Image
      src={popupFundsWordmarkSrc()}
      alt="Popup Funds"
      width={POPUP_FUNDS_WORDMARK.width}
      height={POPUP_FUNDS_WORDMARK.height}
      unoptimized
      priority={priority}
      draggable={false}
      className={cn(
        'pointer-events-none select-none object-contain object-left',
        WORDMARK_HEIGHTS[size],
        className
      )}
    />
  )
}

type PopupFundsLogoMarkSize = 'sm' | 'md' | 'lg' | 'xl'

const LOGO_MARK_HEIGHTS: Record<PopupFundsLogoMarkSize, string> = {
  sm: 'h-10',
  md: 'h-14',
  lg: 'h-24 sm:h-28',
  xl: 'h-28 sm:h-36',
}

export function PopupFundsLogoMark({
  className,
  size = 'md',
}: {
  className?: string
  size?: PopupFundsLogoMarkSize
}) {
  return (
    <Image
      src={popupFundsLogoSrc()}
      alt="Popup Funds"
      width={POPUP_FUNDS_LOGO.width}
      height={POPUP_FUNDS_LOGO.height}
      unoptimized
      draggable={false}
      className={cn('w-auto object-contain', LOGO_MARK_HEIGHTS[size], className)}
    />
  )
}
