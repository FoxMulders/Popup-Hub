import Link from 'next/link'
import { getBuildInfo } from '@/lib/build-info'
import { COPYRIGHT_NOTICE, PRODUCT_BRAND_NAME } from '@/lib/legal/entity'
import { LEGAL_LINKS } from '@/lib/legal/links'
import {
  SITE_FOOTER_MARKETING_LINKS,
  SITE_FOOTER_MOBILE_MARKETING_LINKS,
} from '@/lib/nav/site-footer-links'
import { cn } from '@/lib/utils'

interface BuildVersionFooterProps {
  className?: string
}

export function BuildVersionFooter({ className }: BuildVersionFooterProps) {
  const build = getBuildInfo()
  const tooltip = build.label
  const buildLine = `v${build.version} · build ${build.buildNumber} · ${build.commit}`

  return (
    <footer
      className={cn(
        'popup-hub-chrome-footer mt-auto shrink-0 border-t border-stone-200/60 bg-cream/90 backdrop-blur-sm',
        className
      )}
      aria-label="Site footer"
      title={tooltip}
    >
      <div
        className={cn(
          'mx-auto flex max-w-[1600px] flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1',
          'px-4 py-3 sm:gap-x-4 xl:px-10',
          'pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]'
        )}
      >
        <nav aria-label="Site links" className="min-w-0 flex-1">
          <ul className="m-0 flex list-none flex-row flex-wrap items-center justify-center gap-x-4 gap-y-1 p-0 sm:justify-start">
            {SITE_FOOTER_MOBILE_MARKETING_LINKS.map(({ href, label }) => (
              <li key={`mobile-${href}`} className="m-0 sm:hidden">
                <Link
                  href={href}
                  className="inline-flex min-h-8 items-center text-xs font-medium text-foreground/75 transition-colors hover:text-forest hover:underline touch-manipulation sm:text-sm"
                >
                  {label}
                </Link>
              </li>
            ))}
            {SITE_FOOTER_MARKETING_LINKS.map(({ href, label }) => (
              <li key={`desktop-${href}`} className="m-0 hidden sm:list-item">
                <Link
                  href={href}
                  className="inline-flex min-h-8 items-center text-xs font-medium text-foreground/75 transition-colors hover:text-forest hover:underline touch-manipulation sm:text-sm"
                >
                  {label}
                </Link>
              </li>
            ))}
            {LEGAL_LINKS.filter((link) => link.href !== '/legal/about').map(({ href, label }) => (
              <li key={href} className="m-0 hidden sm:list-item">
                <Link
                  href={href}
                  className="inline-flex min-h-8 items-center text-xs font-medium text-foreground/60 transition-colors hover:text-forest hover:underline touch-manipulation sm:text-sm"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="m-0 shrink-0 text-right text-xs text-muted-foreground sm:text-sm">
          <span className="block sm:inline">{PRODUCT_BRAND_NAME}</span>
          <span className="hidden sm:inline"> · </span>
          <span className="block sm:inline">{COPYRIGHT_NOTICE}</span>
          <span
            className="sr-only font-mono"
            data-testid="build-version-footer"
            data-build-version={build.version}
            data-build-number={build.buildNumber}
            data-build-commit={build.commit}
            data-build-environment={build.environment}
          >
            {buildLine}
          </span>
        </p>
      </div>
    </footer>
  )
}
