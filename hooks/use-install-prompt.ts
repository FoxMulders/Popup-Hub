'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  type BeforeInstallPromptEvent,
  canShowIosInstallCoach,
  isBeforeInstallPromptEvent,
  isStandaloneDisplayMode,
} from '@/lib/pwa/platform'

const DISMISS_KEY = 'popup-hub-pwa-install-dismissed'

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false)
  const [showIosCoach, setShowIosCoach] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    setIsInstalled(isStandaloneDisplayMode())
    setIsDismissed(window.localStorage.getItem(DISMISS_KEY) === '1')

    if (canShowIosInstallCoach()) {
      setShowIosCoach(true)
    }

    function handleBeforeInstallPrompt(event: Event) {
      if (isStandaloneDisplayMode()) return
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return
      if (!isBeforeInstallPromptEvent(event)) return

      event.preventDefault()
      setDeferredPrompt(event)
      setShowAndroidPrompt(true)
      setShowIosCoach(false)
    }

    function handleAppInstalled() {
      setIsInstalled(true)
      setShowAndroidPrompt(false)
      setShowIosCoach(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const dismiss = useCallback(() => {
    window.localStorage.setItem(DISMISS_KEY, '1')
    setIsDismissed(true)
    setShowAndroidPrompt(false)
    setShowIosCoach(false)
  }, [])

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice

    setDeferredPrompt(null)
    setShowAndroidPrompt(false)

    if (choice.outcome === 'accepted') {
      setIsInstalled(true)
    }
  }, [deferredPrompt])

  const visible =
    !isInstalled &&
    !isDismissed &&
    (showAndroidPrompt || showIosCoach)

  return {
    visible,
    showAndroidPrompt,
    showIosCoach,
    triggerInstall,
    dismiss,
    canInstall: Boolean(deferredPrompt),
  }
}
