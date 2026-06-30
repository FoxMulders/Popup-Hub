'use client'

import { usePageBack } from '@/hooks/use-page-back'
import { useSwipeBack } from '@/hooks/use-swipe-back'

/** Enables edge swipe-to-go-back on mobile when back navigation is available. */
export function SwipeBackHandler() {
  const { canGoBack, goBack } = usePageBack()

  useSwipeBack({
    enabled: canGoBack,
    onSwipeBack: goBack,
  })

  return null
}
