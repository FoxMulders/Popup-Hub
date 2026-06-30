'use client'

import { useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
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

export function usePageBack() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const canGoBack = !isPageBackExcluded(pathname)

  const goBack = useCallback(() => {
    navigateBack(router, pathname)
  }, [router, pathname])

  return { canGoBack, goBack, pathname }
}
