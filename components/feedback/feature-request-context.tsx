'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { resolveActivePortal } from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'
import { FeatureRequestModal } from '@/components/feedback/feature-request-modal'

interface FeatureRequestContextValue {
  open: () => void
  close: () => void
}

const FeatureRequestContext = createContext<FeatureRequestContextValue | null>(null)

export function useFeatureRequest(): FeatureRequestContextValue {
  const ctx = useContext(FeatureRequestContext)
  if (!ctx) {
    throw new Error('useFeatureRequest must be used within FeatureRequestProvider')
  }
  return ctx
}

interface FeatureRequestProviderProps {
  profile: Profile
  portalCookie?: string
  children: ReactNode
}

export function FeatureRequestProvider({
  profile,
  portalCookie,
  children,
}: FeatureRequestProviderProps) {
  const pathname = usePathname() ?? ''
  const [open, setOpen] = useState(false)
  const activePortal = resolveActivePortal(portalCookie, profile, pathname)

  const value = useMemo(
    () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
    }),
    []
  )

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next)
  }, [])

  return (
    <FeatureRequestContext.Provider value={value}>
      {children}
      <FeatureRequestModal
        open={open}
        onOpenChange={handleOpenChange}
        profile={profile}
        activePortal={activePortal}
        pagePath={pathname}
      />
    </FeatureRequestContext.Provider>
  )
}
