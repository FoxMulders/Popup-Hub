import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  HUBGUARD_LOGO,
  hubguardLogoSrc,
} from '@/lib/brand/hubguard-logo-paths'

type HubGuardLogoVariant = 'lockup' | 'icon'

const SIZE_CLASSES: Record<HubGuardLogoVariant, Record<'sm' | 'md' | 'lg', string>> = {
  lockup: {
    sm: 'h-10 w-auto',
    md: 'h-14 w-auto sm:h-16',
    lg: 'h-20 w-auto sm:h-24',
  },
  icon: {
    sm: 'h-8 w-8',
    md: 'h-10 w-10 sm:h-11 sm:w-11',
    lg: 'h-14 w-14 sm:h-16 sm:w-16',
  },
}

interface HubGuardLogoProps {
  variant?: HubGuardLogoVariant
  size?: 'sm' | 'md' | 'lg'
  className?: string
  href?: string
  priority?: boolean
  title?: string
}

export function HubGuardLogo({
  variant = 'lockup',
  size = 'md',
  className,
  href,
  priority = false,
  title = 'HubGuard',
}: HubGuardLogoProps) {
  const asset = variant === 'icon' ? HUBGUARD_LOGO.icon : HUBGUARD_LOGO.lockup
  const src = hubguardLogoSrc(variant)

  const image = (
    <Image
      src={src}
      alt={title}
      width={asset.width}
      height={asset.height}
      unoptimized
      priority={priority}
      draggable={false}
      className={cn(
        'pointer-events-none max-w-full select-none object-contain object-left',
        SIZE_CLASSES[variant][size],
        className,
      )}
    />
  )

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0 rounded-md" aria-label={title}>
        {image}
      </Link>
    )
  }

  return <span className="inline-flex shrink-0">{image}</span>
}
