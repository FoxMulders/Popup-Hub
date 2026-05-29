import { cn } from '@/lib/utils'

interface BuildVersionStripProps {
  className?: string
}

/** Build metadata from compile-time NEXT_PUBLIC_* env (safe for client bundles). */
function stripBuildMeta() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION?.trim()
  const commit =
    process.env.NEXT_PUBLIC_GIT_HASH?.trim() ||
    process.env.NEXT_PUBLIC_BUILD_COMMIT?.trim()
  const buildNumberRaw = process.env.NEXT_PUBLIC_BUILD_NUMBER?.trim()
  const buildNumber =
    buildNumberRaw && /^\d+$/.test(buildNumberRaw) ? Number(buildNumberRaw) : 0

  if (!version || !commit) {
    return {
      version: 'local-dev',
      buildNumber: 0,
      commit: 'local',
      label: 'Local development build',
    }
  }

  return {
    version,
    buildNumber,
    commit,
    label: `v${version} · build ${buildNumber} · ${commit}`,
  }
}

/** Always-visible build identity bar (version · build # · commit). */
export function BuildVersionStrip({ className }: BuildVersionStripProps) {
  const build = stripBuildMeta()

  return (
    <div
      className={cn(
        'build-version-strip flex h-[var(--build-strip-height,1.75rem)] shrink-0 items-center justify-center gap-1.5',
        'border-t border-stone-200/80 bg-cream/95 px-3 font-mono text-[10px] leading-none text-muted-foreground backdrop-blur-sm',
        'safe-bottom',
        className
      )}
      title={build.label}
      data-testid="build-version-strip"
      data-build-version={build.version}
      data-build-number={build.buildNumber}
      data-build-commit={build.commit}
      aria-label={`Application build ${build.version}, build number ${build.buildNumber}, commit ${build.commit}`}
    >
      <span>v{build.version}</span>
      <span aria-hidden className="text-stone-400">
        ·
      </span>
      <span>build {build.buildNumber}</span>
      <span aria-hidden className="text-stone-400">
        ·
      </span>
      <span>{build.commit}</span>
    </div>
  )
}
