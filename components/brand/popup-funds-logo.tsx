import Image from 'next/image'
import { cn } from '@/lib/utils'
import {
  POPUP_FUNDS_LOGO,
  POPUP_FUNDS_WORDMARK,
  popupFundsLogoSrc,
  popupFundsWordmarkSrc,
} from '@/lib/brand/popup-funds-paths'

export function PopupFundsWordmark({
  className,
  priority = false,
}: {
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src={popupFundsWordmarkSrc()}
      alt="PopupFunds"
      width={POPUP_FUNDS_WORDMARK.width}
      height={POPUP_FUNDS_WORDMARK.height}
      unoptimized
      priority={priority}
      draggable={false}
      className={cn(
        'pointer-events-none h-8 w-auto max-w-full select-none object-contain object-left sm:h-9',
        className
      )}
    />
  )
}

export function PopupFundsLogoMark({
  className,
  size = 'md',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const heights = { sm: 'h-8', md: 'h-12', lg: 'h-16' }
  return (
    <Image
      src={popupFundsLogoSrc()}
      alt="PopupFunds"
      width={POPUP_FUNDS_LOGO.width}
      height={POPUP_FUNDS_LOGO.height}
      unoptimized
      draggable={false}
      className={cn('w-auto object-contain', heights[size], className)}
    />
  )
}
