'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  postUpgradeToNative,
  redirectToSquareOnboarding,
} from '@/lib/markets/upgrade-to-native'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const UNLOCK_FADE_MS = 300

export interface MarketUpgradeButtonProps {
  eventId: string
  squareConnected?: boolean
  className?: string
  size?: 'sm' | 'default'
  onUpgraded?: () => void
}

export function MarketUpgradeButton({
  eventId,
  squareConnected = false,
  className,
  size = 'default',
  onUpgraded,
}: MarketUpgradeButtonProps) {
  const router = useRouter()
  const [unlocking, setUnlocking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpgrade = useCallback(async () => {
    if (!eventId || unlocking) return

    setError(null)
    setUnlocking(true)

    try {
      const result = await postUpgradeToNative(eventId)

      window.setTimeout(() => {
        setUnlocking(false)
        onUpgraded?.()
        router.refresh()

        if (!squareConnected && result.squareOAuth.authorizeUrl) {
          redirectToSquareOnboarding(result.squareOAuth.authorizeUrl)
        }
      }, UNLOCK_FADE_MS)
    } catch (err) {
      setUnlocking(false)
      setError(err instanceof Error ? err.message : 'Upgrade failed')
    }
  }, [eventId, onUpgraded, router, squareConnected, unlocking])

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <button
        type="button"
        onClick={handleUpgrade}
        disabled={unlocking}
        className={cn(
          buttonVariants({ size: size === 'sm' ? 'sm' : 'default' }),
          'bg-[#FF6B35] text-white hover:bg-[#e85f2f]',
          unlocking && 'opacity-60'
        )}
      >
        {unlocking ? 'Upgrading…' : 'Upgrade to Native (Free)'}
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
