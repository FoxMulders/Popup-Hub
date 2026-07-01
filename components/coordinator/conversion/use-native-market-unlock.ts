'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  postUpgradeToNative,
  redirectToSquareOnboarding,
} from '@/lib/markets/upgrade-to-native'
import { useMarketManagement } from '@/components/coordinator/dashboard/market-management-context'

const UNLOCK_FADE_MS = 300

export interface UseNativeMarketUnlockOptions {
  squareConnected: boolean
  onUnlocked?: () => void
}

export function useNativeMarketUnlock({
  squareConnected,
  onUnlocked,
}: UseNativeMarketUnlockOptions) {
  const router = useRouter()
  const { selectedEventId, patchEventListingMode } = useMarketManagement()
  const [unlocking, setUnlocking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpgrade = useCallback(async () => {
    if (!selectedEventId || unlocking) return

    setError(null)
    setUnlocking(true)

    try {
      const result = await postUpgradeToNative(selectedEventId)
      patchEventListingMode(selectedEventId, false)

      window.setTimeout(() => {
        setUnlocking(false)
        onUnlocked?.()
        router.refresh()

        if (!squareConnected && result.squareOAuth.authorizeUrl) {
          redirectToSquareOnboarding(result.squareOAuth.authorizeUrl)
        }
      }, UNLOCK_FADE_MS)
    } catch (err) {
      setUnlocking(false)
      setError(err instanceof Error ? err.message : 'Upgrade failed')
    }
  }, [
    onUnlocked,
    patchEventListingMode,
    router,
    selectedEventId,
    squareConnected,
    unlocking,
  ])

  return {
    unlocking,
    error,
    handleUpgrade,
  }
}
