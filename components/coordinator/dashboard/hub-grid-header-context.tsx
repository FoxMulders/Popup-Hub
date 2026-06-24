'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface SaveHandlers {
  onSaveDraft: () => void | Promise<void>
  onSaveMarket: () => void | Promise<void>
  saveDraftLoading?: boolean
  saveMarketLoading?: boolean
}

interface HubGridHeaderContextValue {
  placedCount: number
  setPlacedCount: (count: number) => void
  saveDraftLoading: boolean
  saveMarketLoading: boolean
  onSaveDraft: () => void
  onSaveMarket: () => void
  registerSaveHandlers: (handlers: SaveHandlers | null) => void
}

const HubGridHeaderContext = createContext<HubGridHeaderContextValue | null>(null)

export function HubGridHeaderProvider({ children }: { children: ReactNode }) {
  const [placedCount, setPlacedCount] = useState(0)
  const [handlers, setHandlers] = useState<SaveHandlers | null>(null)

  const registerSaveHandlers = useCallback((next: SaveHandlers | null) => {
    setHandlers(next)
  }, [])

  const onSaveDraft = useCallback(() => {
    void handlers?.onSaveDraft()
  }, [handlers])

  const onSaveMarket = useCallback(() => {
    void handlers?.onSaveMarket()
  }, [handlers])

  const value = useMemo(
    () => ({
      placedCount,
      setPlacedCount,
      saveDraftLoading: handlers?.saveDraftLoading ?? false,
      saveMarketLoading: handlers?.saveMarketLoading ?? false,
      onSaveDraft,
      onSaveMarket,
      registerSaveHandlers,
    }),
    [
      placedCount,
      handlers,
      onSaveDraft,
      onSaveMarket,
      registerSaveHandlers,
    ]
  )

  return (
    <HubGridHeaderContext.Provider value={value}>{children}</HubGridHeaderContext.Provider>
  )
}

export function useHubGridHeader() {
  const ctx = useContext(HubGridHeaderContext)
  if (!ctx) {
    return {
      placedCount: 0,
      setPlacedCount: () => {},
      saveDraftLoading: false,
      saveMarketLoading: false,
      onSaveDraft: () => {},
      onSaveMarket: () => {},
      registerSaveHandlers: () => {},
    }
  }
  return ctx
}
