import { PopupHubLogo } from '@/components/brand/popup-hub-logo'
import { getBuildInfo } from '@/lib/build-info'
import { cn } from '@/lib/utils'

interface BuildVersionFooterProps {
  className?: string
}

export function BuildVersionFooter({ className }: BuildVersionFooterProps) {
  const build = getBuildInfo()

  return (
    <footer
      className={cn(
        'mt-auto shrink-0 border-t border-stone-200/80 bg-cream/95 backdrop-blur-sm',
        className
      )}
      aria-label="Application version"
    >
      <div className="mx-auto flex max-w-[1600px] items-center justify-center gap-2.5 px-4 py-2.5 sm:gap-3 sm:py-3">
        <PopupHubLogo className="h-7 w-auto shrink-0 sm:h-8" title="Popup Hub" />
        <div className="min-w-0 text-center">
          <p className="sr-only font-heading text-xs font-semibold text-forest sm:text-sm">
            Popup Hub
          </p>
          <p
            className="font-mono text-[10px] leading-snug text-muted-foreground sm:text-[11px]"
            title={`Version ${build.version}, commit ${build.commit}, built ${build.builtAt}`}
          >
            {build.label}
          </p>
        </div>
      </div>
    </footer>
  )
}
