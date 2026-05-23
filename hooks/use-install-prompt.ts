'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  type BeforeInstallPromptEvent,
  canShowAndroidInstallPrompt,
  canShowIosInstallCoach,
  canShowIosOpenInSafariCoach,
  isBeforeInstallPromptEvent,
  isMobileDevice,
  isStandaloneDisplayMode,
} from '@/lib/pwa/platform'

const DISMISS_KEY = 'popup-hub-pwa-install-dismissed-mobile'

export function useInstallPrompt() {
  const [isMobile, setIsMobile] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false)
  const [showIosCoach, setShowIosCoach] = useState(false)
  const [showIosOpenInSafariCoach, setShowIosOpenInSafariCoach] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mobile = isMobileDevice()
    setIsMobile(mobile)
    if (!mobile) return

    setIsInstalled(isStandaloneDisplayMode())

    const dismissed = window.localStorage.getItem(DISMISS_KEY) === '1'
    setIsDismissed(dismissed)
    if (dismissed || isStandaloneDisplayMode()) return

    if (canShowIosInstallCoach()) {
      setShowIosCoach(true)
    } else if (canShowIosOpenInSafariCoach()) {
      setShowIosOpenInSafariCoach(true)
    } else if (canShowAndroidInstallPrompt()) {
      setShowAndroidPrompt(true)
    }

    function handleBeforeInstallPrompt(event: Event) {
      if (!isMobileDevice() || isStandaloneDisplayMode()) return
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return
      if (!isBeforeInstallPromptEvent(event)) return

      event.preventDefault()
      setDeferredPrompt(event)
      setShowAndroidPrompt(true)
      setShowIosCoach(false)
      setShowIosOpenInSafariCoach(false)
    }

    function handleAppInstalled() {
      setIsInstalled(true)
      setShowAndroidPrompt(false)
      setShowIosCoach(false)
      setShowIosOpenInSafariCoach(false)
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
    setShowIosOpenInSafariCoach(false)
  }, [])

  const triggerInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice

    setDeferredPrompt(null)
    setShowAndroidPrompt(false)

    if (choice.outcome === 'accepted') {
      setIsInstalled(true)
    }

    return true
  }, [deferredPrompt])

  const visible =
    isMobile &&
    !isInstalled &&
    !isDismissed &&
    (showAndroidPrompt || showIosCoach || showIosOpenInSafariCoach)

  return {
    visible,
    showAndroidPrompt,
    showIosCoach,
    showIosOpenInSafariCoach,
    triggerInstall,
    dismiss,
  }
}
