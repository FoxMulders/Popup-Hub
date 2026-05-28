import Link from 'next/link'
import { PopupHubLogo } from '@/components/brand/popup-hub-logo'
import { getBuildInfo } from '@/lib/build-info'
import { LEGAL_LINKS } from '@/lib/legal/links'
import { cn } from '@/lib/utils'

interface BuildVersionFooterProps {
  className?: string
}

const ENV_BADGE: Record<ReturnType<typeof getBuildInfo>['environment'], string> = {
  production: 'prod',
  preview: 'preview',
  development: 'dev',
  local: 'local',
}

export function BuildVersionFooter({ className }: BuildVersionFooterProps) {
  const build = getBuildInfo()
  const year = new Date().getFullYear()
  const envTag = ENV_BADGE[build.environment]
  const primaryLabel = `v${build.baseVersion} · build ${build.buildNumber}`
  const secondaryLabel = `${build.commit} · ${envTag}`
  const tooltip = `Version ${build.version}, build ${build.buildNumber}, commit ${build.commit}, built ${build.builtAt} (${build.environment})`

  return (
    <footer
      className={cn(
        'mt-auto shrink-0 border-t border-stone-200/80 bg-cream/95 backdrop-blur-sm',
        'max-md:pb-[calc(4.5rem+env(safe-area-inset-bottom))]',
        'workspace-fullscreen-hide',
        className
      )}
      aria-label="Site footer"
    >
      <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-1.5 px-4 py-3 sm:gap-2 sm:py-3.5 xl:px-10">
        <nav aria-label="Legal and help">
          <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:gap-x-5">
            {LEGAL_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-foreground/80 hover:text-sage-700 hover:underline touch-manipulation"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <PopupHubLogo compact className="relative z-20 shrink-0" title="Popup Hub" />

        <div className="flex flex-col items-center gap-0.5 text-center">
          <p className="text-xs text-muted-foreground sm:text-sm">
            © {year} Popup Hub. All rights reserved.
          </p>
          <p
            className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0 font-mono text-[10px] leading-snug text-muted-foreground sm:text-[11px]"
            title={tooltip}
            data-testid="build-version-footer"
            data-build-version={build.version}
            data-build-commit={build.commit}
            data-build-environment={build.environment}
          >
            <span className="font-semibold text-foreground/80">{primaryLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{secondaryLabel}</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
