'use client'

import { Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useInstallPrompt } from '@/hooks/use-install-prompt'

export function InstallPrompt() {
  const { visible, showAndroidPrompt, showIosCoach, triggerInstall, dismiss, canInstall } =
    useInstallPrompt()

  if (!visible) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="region"
      aria-label="Install Popup Hub app"
    >
      {showAndroidPrompt ? (
        <div className="pointer-events-auto flex w-full max-w-lg items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-lg">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-xl">
            📲
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Install Popup Hub App</p>
            <p className="text-xs text-muted-foreground">
              Add to your home screen for quick access to markets and applications.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button
              size="sm"
              className="min-h-10 whitespace-nowrap"
              onClick={() => void triggerInstall()}
              disabled={!canInstall}
            >
              📲 Install Popup Hub App
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-10 px-2"
              onClick={dismiss}
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {showIosCoach ? (
        <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100">
              <Share className="h-5 w-5 text-foreground" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold text-foreground">Install Popup Hub</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                To install, tap the <span className="font-medium text-foreground">Share</span>{' '}
                icon at the bottom of Safari and select{' '}
                <span className="font-medium text-foreground">Add to Home Screen</span>.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-10 shrink-0 px-2"
              onClick={dismiss}
              aria-label="Dismiss install instructions"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
