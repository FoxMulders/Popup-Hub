'use client'

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { useNativeFullscreen } from './use-native-fullscreen'

export interface FullscreenLayoutContextValue {
  active: boolean
  enterFullscreen: () => Promise<void>
  exitFullscreen: () => Promise<void>
}

const FullscreenLayoutContext =
  createContext<FullscreenLayoutContextValue | null>(null)

export function useFullscreenLayout(): FullscreenLayoutContextValue {
  const ctx = useContext(FullscreenLayoutContext)
  if (!ctx) {
    return {
      active: false,
      enterFullscreen: async () => {},
      exitFullscreen: async () => {},
    }
  }
  return ctx
}

export interface FullscreenLayoutProps {
  active: boolean
  onActiveChange: (active: boolean) => void
  /** Layout tools / planner header — hidden in native fullscreen. */
  header?: ReactNode
  /** Canvas + command bar region. */
  children: ReactNode
  /** Persistent exit control (shown while fullscreen). */
  fullscreenToolbar?: ReactNode
  className?: string
}

/**
 * Canvas editor shell — flex layout (no absolute hacks). Toggles native
 * fullscreen + `popup-hub-canvas-fullscreen` document class for chrome hiding.
 */
export function FullscreenLayout({
  active,
  onActiveChange,
  header,
  children,
  fullscreenToolbar,
  className,
}: FullscreenLayoutProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { enter, exit } = useNativeFullscreen({
    active,
    onActiveChange,
    targetRef: rootRef,
  })

  const contextValue = useMemo(
    () => ({
      active,
      enterFullscreen: enter,
      exitFullscreen: exit,
    }),
    [active, enter, exit]
  )

  return (
    <FullscreenLayoutContext.Provider value={contextValue}>
      <div
        ref={rootRef}
        id="canvas-editor-root"
        className={cn(
          'canvas-editor-root flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          active && 'canvas-editor-root--fullscreen',
          className
        )}
      >
        {header ? (
          <header className="canvas-editor-header popup-hub-chrome-header shrink-0">
            {header}
          </header>
        ) : null}

        {active && fullscreenToolbar ? (
          <div
            className="canvas-fullscreen-toolbar shrink-0 border-b border-stone-200/80 bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur-sm"
            role="toolbar"
            aria-label="Fullscreen canvas controls"
          >
            {fullscreenToolbar}
          </div>
        ) : null}

        <div className="canvas-container pointer-events-auto relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </FullscreenLayoutContext.Provider>
  )
}
