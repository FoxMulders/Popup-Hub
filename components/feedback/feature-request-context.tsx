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
import { FeatureRequestFab } from '@/components/feedback/feature-request-fab'

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
  /** Hide floating action button (e.g. dense canvas routes). */
  hideFab?: boolean
}

export function FeatureRequestProvider({
  profile,
  portalCookie,
  children,
  hideFab = false,
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
      {!hideFab ? <FeatureRequestFab onClick={value.open} /> : null}
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
