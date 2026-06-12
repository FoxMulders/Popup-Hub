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
import type { FeatureSubmitterRole } from '@/lib/feedback/feature-request-config'
import type { Profile } from '@/types/database'
import { FeatureRequestModal } from '@/components/feedback/feature-request-modal'

export interface FeatureRequestPrefill {
  title?: string
  problem?: string
  dreamSolution?: string
  submitterRole?: FeatureSubmitterRole
  targetComponent?: string
}

interface FeatureRequestContextValue {
  open: () => void
  openWithPrefill: (prefill: FeatureRequestPrefill) => void
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
  const [prefill, setPrefill] = useState<FeatureRequestPrefill | null>(null)
  const activePortal = resolveActivePortal(portalCookie, profile, pathname)

  const value = useMemo(
    () => ({
      open: () => {
        setPrefill(null)
        setOpen(true)
      },
      openWithPrefill: (next: FeatureRequestPrefill) => {
        setPrefill(next)
        setOpen(true)
      },
      close: () => setOpen(false),
    }),
    []
  )

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next)
    if (!next) setPrefill(null)
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
        prefill={prefill}
      />
    </FeatureRequestContext.Provider>
  )
}
