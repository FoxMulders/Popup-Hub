'use client'

import { usePageBack } from '@/hooks/use-page-back'
import { useSwipeBack } from '@/hooks/use-swipe-back'

/** Enables bidirectional edge swipe history on mobile (left = back, right = forward). */
export function SwipeBackHandler() {
  const { canSwipeBack, goBack, canSwipeForward, goForward } = usePageBack()

  useSwipeBack({
    enabledBack: canSwipeBack,
    onSwipeBack: goBack,
    enabledForward: canSwipeForward,
    onSwipeForward: goForward,
  })

  return null
}
