import Link from 'next/link'
import { getBuildInfo } from '@/lib/build-info'
import { LEGAL_LINKS } from '@/lib/legal/links'
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
        'popup-hub-chrome-footer mt-auto shrink-0 border-t border-stone-200/80 bg-cream/95 backdrop-blur-sm',
        className
      )}
      aria-label="Site footer"
    >
      <div
        className={cn(
          'mx-auto flex max-w-[1600px] flex-col items-center gap-2',
          'px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-1 sm:py-2 xl:px-10',
          'pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]'
        )}
      >
        <nav aria-label="Legal and help" className="min-w-0 w-full sm:flex-1">
          <div className="flex flex-col items-center gap-1 sm:hidden">
            <ul className="m-0 flex list-none justify-center gap-x-3 p-0">
              {LEGAL_LINKS.slice(0, 3).map(({ href, label }) => (
                <li key={href} className="m-0">
                  <Link
                    href={href}
                    className="inline-flex min-h-6 items-center px-0.5 text-[10px] font-medium text-foreground/80 hover:text-sage-700 hover:underline touch-manipulation"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="m-0 flex list-none justify-center gap-x-3 p-0">
              {LEGAL_LINKS.slice(3).map(({ href, label }) => (
                <li key={href} className="m-0">
                  <Link
                    href={href}
                    className="inline-flex min-h-6 items-center px-0.5 text-[10px] font-medium text-foreground/80 hover:text-sage-700 hover:underline touch-manipulation"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <ul className="m-0 hidden list-none flex-row flex-wrap items-center justify-start gap-x-4 gap-y-0 p-0 sm:flex">
            {LEGAL_LINKS.map(({ href, label }) => (
              <li key={href} className="m-0">
                <Link
                  href={href}
                  className="inline-flex min-h-7 items-center px-0.5 text-xs font-medium text-foreground/80 hover:text-sage-700 hover:underline touch-manipulation"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p
          className="m-0 flex shrink-0 flex-row flex-wrap items-center justify-center gap-x-1.5 text-center text-xs leading-snug text-muted-foreground sm:justify-end sm:text-sm"
          title={tooltip}
        >
          <span>Popup Hub</span>
          <span className="text-stone-300" aria-hidden>
            ·
          </span>
          <span
            className="font-mono text-[10px] sm:text-[11px]"
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
