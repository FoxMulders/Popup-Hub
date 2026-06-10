'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type LayoutSaveStatus = 'idle' | 'saving' | 'saved'

interface DashboardLayoutSaveContextValue {
  status: LayoutSaveStatus
  markSaving: () => void
  markSaved: () => void
}

const DashboardLayoutSaveContext =
  createContext<DashboardLayoutSaveContextValue | null>(null)

export function DashboardLayoutSaveProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LayoutSaveStatus>('idle')

  const markSaving = useCallback(() => {
    setStatus('saving')
  }, [])

  const markSaved = useCallback(() => {
    setStatus('saved')
  }, [])

  const value = useMemo(
    () => ({ status, markSaving, markSaved }),
    [markSaving, markSaved, status]
  )

  return (
    <DashboardLayoutSaveContext.Provider value={value}>
      {children}
    </DashboardLayoutSaveContext.Provider>
  )
}

export function useDashboardLayoutSave() {
  return useContext(DashboardLayoutSaveContext)
}
