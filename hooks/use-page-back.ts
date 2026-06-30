'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  applyPopstatePath,
  canGoBackFromStack,
  canGoForwardFromStack,
  createHistoryStack,
  hasNavigationApi,
  pushHistoryPath,
  readNavigationApiCanGoBack,
  readNavigationApiCanGoForward,
  type HistoryStackState,
  type NavigationWithHistory,
} from '@/lib/navigation/history-forward'
import { isPageBackExcluded, pageBackFallbackHref } from '@/lib/navigation/page-back'

export function navigateBack(
  router: { back: () => void; push: (href: string) => void },
  pathname: string
): void {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
    return
  }
  router.push(pageBackFallbackHref(pathname))
}

function currentLocationPath(): string {
  if (typeof window === 'undefined') return ''
  return window.location.pathname + window.location.search
}

interface HistoryNavigationState {
  canSwipeBack: boolean
  canSwipeForward: boolean
}

function useHistoryNavigation(pathname: string): HistoryNavigationState {
  const [state, setState] = useState<HistoryNavigationState>({
    canSwipeBack: false,
    canSwipeForward: false,
  })
  const stackRef = useRef<HistoryStackState | null>(null)
  const fromPopstateRef = useRef(false)
  const usesNavigationApiRef = useRef(hasNavigationApi())

  const syncFromStack = useCallback((stackState: HistoryStackState) => {
    setState({
      canSwipeBack: canGoBackFromStack(stackState),
      canSwipeForward: canGoForwardFromStack(stackState),
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (usesNavigationApiRef.current) {
      const sync = () => {
        const canSwipeBack = readNavigationApiCanGoBack()
        const canSwipeForward = readNavigationApiCanGoForward()
        if (canSwipeBack === null || canSwipeForward === null) return
        setState({ canSwipeBack, canSwipeForward })
      }
      sync()

      const nav = (window as Window & { navigation?: NavigationWithHistory }).navigation
      if (!nav) return

      nav.addEventListener('navigate', sync)
      nav.addEventListener('currententrychange', sync)
      return () => {
        nav.removeEventListener('navigate', sync)
        nav.removeEventListener('currententrychange', sync)
      }
    }

    stackRef.current = createHistoryStack(currentLocationPath())
    syncFromStack(stackRef.current)

    function onPopstate() {
      fromPopstateRef.current = true
      const current = stackRef.current
      if (!current) return
      stackRef.current = applyPopstatePath(current, currentLocationPath())
      syncFromStack(stackRef.current)
    }

    window.addEventListener('popstate', onPopstate)
    return () => window.removeEventListener('popstate', onPopstate)
  }, [syncFromStack])

  useEffect(() => {
    if (usesNavigationApiRef.current) return

    if (fromPopstateRef.current) {
      fromPopstateRef.current = false
      return
    }

    const routePath = currentLocationPath()
    const current = stackRef.current ?? createHistoryStack(routePath)
    stackRef.current = pushHistoryPath(current, routePath)
    syncFromStack(stackRef.current)
  }, [pathname, syncFromStack])

  return state
}

export function usePageBack() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const canGoBack = !isPageBackExcluded(pathname)
  const { canSwipeBack, canSwipeForward } = useHistoryNavigation(pathname)

  const goBack = useCallback(() => {
    navigateBack(router, pathname)
  }, [router, pathname])

  const goForward = useCallback(() => {
    router.forward()
  }, [router])

  return {
    canGoBack,
    goBack,
    canSwipeBack,
    canSwipeForward,
    goForward,
    pathname,
  }
}
