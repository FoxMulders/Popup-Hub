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

const LEDGER_PANE_STORAGE_KEY = 'popup-hub:dashboard:ledger-pane-collapsed'

interface DashboardWorkspaceViewContextValue {
  view: DashboardWorkspaceView
  setView: (view: DashboardWorkspaceView) => void
  isBlueprint: boolean
  isLedger: boolean
  /** Virtual split-pane — right Allocation Ledger column collapsed */
  ledgerPaneCollapsed: boolean
  setLedgerPaneCollapsed: (collapsed: boolean) => void
  toggleLedgerPane: () => void
}

const DashboardWorkspaceViewContext =
  createContext<DashboardWorkspaceViewContextValue | null>(null)

function parseView(raw: string | null): DashboardWorkspaceView {
  return raw === 'ledger' ? 'ledger' : 'blueprint'
}

function loadLedgerPaneCollapsed(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(LEDGER_PANE_STORAGE_KEY)
    if (raw === null) return true
    return raw === '1'
  } catch {
    return true
  }
}

export function DashboardWorkspaceViewProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const urlView = parseView(searchParams.get('view'))
  const [view, setViewState] = useState<DashboardWorkspaceView>(urlView)
  const [ledgerPaneCollapsed, setLedgerPaneCollapsedState] = useState(true)

  useEffect(() => {
    setViewState(urlView)
  }, [urlView])

  useEffect(() => {
    setLedgerPaneCollapsedState(loadLedgerPaneCollapsed())
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        LEDGER_PANE_STORAGE_KEY,
        ledgerPaneCollapsed ? '1' : '0'
      )
    } catch {
      // ignore
    }
  }, [ledgerPaneCollapsed])

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

  const setLedgerPaneCollapsed = useCallback((collapsed: boolean) => {
    setLedgerPaneCollapsedState(collapsed)
  }, [])

  const toggleLedgerPane = useCallback(() => {
    setLedgerPaneCollapsedState((prev) => !prev)
  }, [])

  const value = useMemo(
    () => ({
      view,
      setView,
      isBlueprint: view === 'blueprint',
      isLedger: view === 'ledger',
      ledgerPaneCollapsed,
      setLedgerPaneCollapsed,
      toggleLedgerPane,
    }),
    [view, setView, ledgerPaneCollapsed, setLedgerPaneCollapsed, toggleLedgerPane]
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
      ledgerPaneCollapsed: false,
      setLedgerPaneCollapsed: () => {},
      toggleLedgerPane: () => {},
    }
  }
  return ctx
}
