'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { refreshPreservingScroll } from '@/lib/navigation/scroll-position'

export function useRefreshPreservingScroll() {
  const router = useRouter()
  return useCallback(() => refreshPreservingScroll(router), [router])
}
