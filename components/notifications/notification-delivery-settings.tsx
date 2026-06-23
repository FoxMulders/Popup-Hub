'use client'

import { Share, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PushNotificationSettings } from '@/components/profile/push-notification-settings'
import { useInstallPrompt } from '@/hooks/use-install-prompt'
import { isStandaloneDisplayMode } from '@/lib/pwa/platform'
import { isNativeApp } from '@/lib/mobile/native-app'

export function NotificationDeliverySettings() {
  const {
    showAndroidPrompt,
    showIosCoach,
    showIosOpenInSafariCoach,
    triggerInstall,
    isMobile,
    isInstalled,
    isDismissed,
  } = useInstallPrompt()

  const standalone =
    typeof window !== 'undefined' &&
    (isStandaloneDisplayMode() || isNativeApp())

  const showInstallBlock =
    isMobile &&
    !standalone &&
    !isInstalled &&
    (showAndroidPrompt || showIosCoach || showIosOpenInSafariCoach || !isDismissed)

  return (
    <div className="space-y-4">
      <PushNotificationSettings />

      {showInstallBlock ? (
        <div className="rounded-2xl border bg-white p-6 space-y-3">
          <div className="flex items-start gap-3">
            <Smartphone className="h-5 w-5 text-forest shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0 space-y-2">
              <h3 className="font-semibold text-foreground">Install the app</h3>
              {showIosCoach ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tap <Share className="inline h-3.5 w-3.5" aria-hidden /> Share in Safari, then{' '}
                  <span className="font-medium text-foreground">Add to Home Screen</span> for push
                  alerts and faster access.
                </p>
              ) : showIosOpenInSafariCoach ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Open this page in Safari to install Popup Hub on your home screen.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Install Popup Hub on your home screen for quick access to markets and
                  applications.
                </p>
              )}
              {showAndroidPrompt ? (
                <Button
                  type="button"
                  size="sm"
                  className="min-h-10"
                  onClick={() => void triggerInstall()}
                >
                  Install app
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : isInstalled || standalone ? (
        <div className="rounded-2xl border border-sage-200 bg-sage-50/60 p-4 text-sm text-sage-900">
          App installed — push alerts work best from your home screen icon.
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground leading-relaxed">
        SMS alerts are configured in Profile settings. Email notifications follow your account
        address.
      </p>
    </div>
  )
}
