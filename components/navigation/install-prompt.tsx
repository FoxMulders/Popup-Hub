'use client'

import { Share, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PopupHubLogo } from '@/components/brand/popup-hub-logo'
import { useInstallPrompt } from '@/hooks/use-install-prompt'

export function InstallPrompt() {
  const {
    visible,
    showAndroidPrompt,
    showIosCoach,
    showIosOpenInSafariCoach,
    triggerInstall,
    dismiss,
  } = useInstallPrompt()

  async function handleAndroidInstall() {
    const prompted = await triggerInstall()
    if (!prompted) {
      toast.info('Tap the Chrome menu (⋮), then choose Install app or Add to Home screen.')
    }
  }

  if (!visible) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 md:hidden"
      role="region"
      aria-label="Install Popup Hub app"
    >
      {showAndroidPrompt ? (
        <div className="pointer-events-auto flex w-full max-w-lg items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-lg">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-transparent">
            <PopupHubLogo className="h-8 w-auto" title="Popup Hub" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Install Popup Hub App</p>
            <p className="text-xs text-muted-foreground">
              Add to your home screen for quick access to markets and applications.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Button
              size="sm"
              className="min-h-10 whitespace-nowrap"
              onClick={() => void handleAndroidInstall()}
            >
              📲 Install App
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
                Tap the <span className="font-medium text-foreground">Share</span> button{' '}
                <span className="inline-block align-middle text-base leading-none">⎋</span> at the
                bottom of Safari, then choose{' '}
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

      {showIosOpenInSafariCoach ? (
        <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold text-foreground">Install on iPhone</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Open this page in <span className="font-medium text-foreground">Safari</span>, then
                tap Share → Add to Home Screen. Install prompts are not available in Chrome on
                iOS.
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
