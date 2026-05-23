import { cn } from '@/lib/utils'

interface PopupHubLogoProps {
  className?: string
  /** Accessible label; omit when decorative (parent has visible text). */
  title?: string
}

/**
 * Popup Hub brand mark: map pin with market canopy + discovery pulse rings.
 */
export function PopupHubLogo({ className, title }: PopupHubLogoProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      role={title ? 'img' : 'presentation'}
      aria-hidden={!title}
    >
      {title ? <title>{title}</title> : null}

      {/* Discovery radius pulses */}
      <circle
        cx="24"
        cy="18"
        r="15.5"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1.25"
      />
      <circle
        cx="24"
        cy="18"
        r="19.5"
        stroke="currentColor"
        strokeOpacity="0.12"
        strokeWidth="1"
      />

      {/* Map pin body with canopy tent cutout */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M24 4.5c-6.904 0-12.5 5.48-12.5 12.25 0 4.01 2.062 7.534 5.188 9.586L24 43.5l7.312-17.164c3.126-2.052 5.188-5.576 5.188-9.586C36.5 9.98 30.904 4.5 24 4.5Zm-4.1 11.1 4.1-3.65 4.1 3.65v5.05h-8.2v-5.05Z"
        fill="currentColor"
      />

      {/* Hub nodes */}
      <circle cx="24" cy="22.5" r="1.35" fill="currentColor" fillOpacity="0.85" />
      <circle cx="19.2" cy="25.2" r="1.1" fill="currentColor" fillOpacity="0.65" />
      <circle cx="28.8" cy="25.2" r="1.1" fill="currentColor" fillOpacity="0.65" />
      <path
        d="M19.8 25.5h8.4"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  )
}

type BrandLogoMarkSize = 'nav' | 'auth'

const MARK_SIZES: Record<
  BrandLogoMarkSize,
  { box: string; icon: string }
> = {
  nav: {
    box: 'h-9 w-9 rounded-xl',
    icon: 'h-5 w-5',
  },
  auth: {
    box: 'h-12 w-12 rounded-2xl md:h-16 md:w-16',
    icon: 'h-7 w-7 md:h-9 md:w-9',
  },
}

interface BrandLogoMarkProps {
  size?: BrandLogoMarkSize
  className?: string
}

/** Logo inside the standard forest-green brand tile. */
export function BrandLogoMark({ size = 'nav', className }: BrandLogoMarkProps) {
  const styles = MARK_SIZES[size]

  return (
    <div
      className={cn(
        'flex items-center justify-center bg-forest text-white shadow-[var(--shadow-market-lift)]',
        styles.box,
        className
      )}
    >
      <PopupHubLogo className={styles.icon} />
    </div>
  )
}
