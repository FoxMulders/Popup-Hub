import Link from 'next/link'
import { getBuildInfo } from '@/lib/build-info'
import { LEGAL_LINKS } from '@/lib/legal/links'
import { cn } from '@/lib/utils'

interface BuildVersionFooterProps {
  className?: string
}

export function BuildVersionFooter({ className }: BuildVersionFooterProps) {
  const build = getBuildInfo()
  const year = new Date().getFullYear()
  const tooltip = build.label
  const buildLine = `v${build.version} · build ${build.buildNumber} · ${build.commit}`

  return (
    <footer
      className={cn(
        'popup-hub-chrome-footer mt-auto shrink-0 border-t border-stone-200/80 bg-cream/95 backdrop-blur-sm safe-bottom',
        className
      )}
      aria-label="Site footer"
    >
      <div
        className={cn(
          'mx-auto flex h-8 max-w-[1600px] items-center justify-between gap-3',
          'px-4 xl:px-10'
        )}
      >
        <nav
          aria-label="Legal and help"
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          <ul className="m-0 flex list-none items-center gap-x-3 whitespace-nowrap p-0 sm:gap-x-4">
            {LEGAL_LINKS.map(({ href, label }) => (
              <li key={href} className="m-0 shrink-0">
                <Link
                  href={href}
                  className="inline-flex items-center text-xs font-medium text-foreground/80 hover:text-sage-700 hover:underline touch-manipulation sm:text-sm"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p
          className="m-0 shrink-0 whitespace-nowrap font-mono text-[10px] leading-none text-muted-foreground sm:text-[11px]"
          title={tooltip}
        >
          <span className="sr-only">© {year} Popup Hub. </span>
          <span
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
