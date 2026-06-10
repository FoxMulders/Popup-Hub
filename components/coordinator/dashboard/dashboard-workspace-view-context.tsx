'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'next/navigation'

export type DashboardWorkspaceView = 'blueprint' | 'ledger'

interface DashboardWorkspaceViewContextValue {
  view: DashboardWorkspaceView
  setView: (view: DashboardWorkspaceView) => void
  isBlueprint: boolean
  isLedger: boolean
}

const DashboardWorkspaceViewContext =
  createContext<DashboardWorkspaceViewContextValue | null>(null)

function parseView(raw: string | null): DashboardWorkspaceView {
  return raw === 'ledger' ? 'ledger' : 'blueprint'
}

export function DashboardWorkspaceViewProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const urlView = parseView(searchParams.get('view'))
  const [view, setViewState] = useState<DashboardWorkspaceView>(urlView)

  useEffect(() => {
    setViewState(urlView)
  }, [urlView])

  const setView = useCallback((next: DashboardWorkspaceView) => {
    setViewState(next)
    const url = new URL(window.location.href)
    if (next === 'ledger') {
      url.searchParams.set('view', 'ledger')
    } else {
      url.searchParams.delete('view')
    }
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [])

  const value = useMemo(
    () => ({
      view,
      setView,
      isBlueprint: view === 'blueprint',
      isLedger: view === 'ledger',
    }),
    [view, setView]
  )

  return (
    <DashboardWorkspaceViewContext.Provider value={value}>
      {children}
    </DashboardWorkspaceViewContext.Provider>
  )
}

export function useDashboardWorkspaceView(): DashboardWorkspaceViewContextValue {
  const ctx = useContext(DashboardWorkspaceViewContext)
  if (!ctx) {
    return {
      view: 'blueprint',
      setView: () => {},
      isBlueprint: true,
      isLedger: false,
    }
  }
  return ctx
}
