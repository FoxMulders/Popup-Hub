'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useMobileViewport } from '@/hooks/use-mobile-viewport'

export type MobileWorkspacePanel = 'wizard' | 'canvas' | 'inspector'

export interface WorkspaceShellProps {
  header: ReactNode
  left: ReactNode
  center: ReactNode
  right: ReactNode
  className?: string
  /** Controlled mobile panel — defaults to canvas. */
  mobilePanel?: MobileWorkspacePanel
  onMobilePanelChange?: (panel: MobileWorkspacePanel) => void
}

const MOBILE_TABS: { id: MobileWorkspacePanel; label: string }[] = [
  { id: 'wizard', label: 'Wizard' },
  { id: 'canvas', label: 'Canvas' },
  { id: 'inspector', label: 'Inspector' },
]

/**
 * Mobile-first IDE workspace:
 * - &lt;768px: single stacked panel with bottom tab bar (wizard | canvas | inspector)
 * - md+: 320px wizard | 1fr canvas
 * - lg+: adds 360px inspector rail
 */
export function WorkspaceShell({
  header,
  left,
  center,
  right,
  className,
  mobilePanel: mobilePanelProp,
  onMobilePanelChange,
}: WorkspaceShellProps) {
  const isMobile = useMobileViewport()
  const [mobilePanelInternal, setMobilePanelInternal] =
    useState<MobileWorkspacePanel>('canvas')
  const mobilePanel = mobilePanelProp ?? mobilePanelInternal
  const setMobilePanel = onMobilePanelChange ?? setMobilePanelInternal

  return (
    <div
      className={cn(
        'flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#0b0f14] text-foreground',
        className
      )}
    >
      <header className="flex min-h-[60px] shrink-0 items-center border-b border-white/10 bg-[#0f1419]/95 px-3 backdrop-blur-sm sm:px-4">
        {header}
      </header>

      {isMobile ? (
        <>
          <div className="min-h-0 flex-1 overflow-hidden">
            {mobilePanel === 'wizard' ? (
              <aside className="h-full min-h-0 overflow-hidden bg-[#0f1419]" aria-label="Design wizard">
                <div className="flex h-full min-h-0 flex-col">{left}</div>
              </aside>
            ) : null}
            {mobilePanel === 'canvas' ? (
              <section
                className="relative h-full min-h-0 min-w-0 overflow-hidden"
                aria-label="Spatial blueprint canvas"
              >
                {center}
              </section>
            ) : null}
            {mobilePanel === 'inspector' ? (
              <aside
                className="h-full min-h-0 overflow-hidden bg-[#0f1419]"
                aria-label="Inspector and telemetry"
              >
                <div className="flex h-full min-h-0 flex-col">{right}</div>
              </aside>
            ) : null}
          </div>
          <nav
            className="grid shrink-0 grid-cols-3 border-t border-white/10 bg-[#0f1419]/95 safe-bottom"
            aria-label="Workspace panels"
          >
            {MOBILE_TABS.map((tab) => {
              const active = mobilePanel === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMobilePanel(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'touch-target flex min-h-12 flex-col items-center justify-center gap-0.5 px-2 py-2 text-[11px] font-semibold transition-colors touch-manipulation',
                    active ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white/80'
                  )}
                >
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,360px)]">
          <aside
            className="hidden min-h-0 overflow-hidden border-r border-white/10 bg-[#0f1419] md:flex md:flex-col"
            aria-label="Design wizard"
          >
            <div className="flex h-full min-h-0 flex-col">{left}</div>
          </aside>
          <section
            className="relative min-h-0 min-w-0 overflow-hidden"
            aria-label="Spatial blueprint canvas"
          >
            {center}
          </section>
          <aside
            className="hidden min-h-0 overflow-hidden border-l border-white/10 bg-[#0f1419] lg:flex lg:flex-col"
            aria-label="Inspector and telemetry"
          >
            <div className="flex h-full min-h-0 flex-col">{right}</div>
          </aside>
        </div>
      )}
    </div>
  )
}
