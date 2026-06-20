import type { ReactNode } from 'react'
import { MarketingHeroBackdrop } from '@/components/public/marketing/marketing-hero-backdrop'
import { cn } from '@/lib/utils'

interface SitePageBandProps {
  eyebrow?: string
  title: string
  description?: string
  children?: ReactNode
  /** forest = immersive band; subtle = light linen strip for legal/docs */
  tone?: 'forest' | 'subtle'
  className?: string
}

export function SitePageBand({
  eyebrow,
  title,
  description,
  children,
  tone = 'forest',
  className,
}: SitePageBandProps) {
  const isForest = tone === 'forest'

  return (
    <section
      className={cn(
        'relative overflow-hidden border-b border-stone-200/50',
        isForest ? 'marketing-hero-mesh text-white' : 'bg-gradient-to-b from-sage-50/80 to-cream text-foreground',
        className
      )}
    >
      {isForest ? <MarketingHeroBackdrop /> : null}
      <div
        className={cn(
          'relative mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10',
          isForest ? '' : 'lg:py-14'
        )}
      >
        {eyebrow ? (
          <p
            className={cn(
              'text-xs font-bold uppercase tracking-widest',
              isForest ? 'text-white/90' : 'text-sage-700'
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            'font-bold tracking-tight',
            eyebrow ? 'mt-2' : '',
            isForest
              ? 'text-2xl text-white sm:text-3xl md:text-4xl'
              : 'text-3xl text-foreground sm:text-4xl'
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              'mt-3 max-w-2xl leading-relaxed',
              isForest
                ? 'text-base text-white/95 sm:text-base'
                : 'text-sm text-muted-foreground sm:text-base'
            )}
          >
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
      {isForest ? <div className="marketing-section-divider" aria-hidden /> : null}
    </section>
  )
}
