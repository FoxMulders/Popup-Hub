'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const MAX_LOG_LINES = 50

export interface DebugLogContextValue {
  logs: string[]
  addLog: (message: string) => void
  /** Alias for `addLog` — geometry coordinate / placement events. */
  logState: (message: string) => void
  clearLogs: () => void
}

const DebugLogContext = createContext<DebugLogContextValue | null>(null)

export function DebugLogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<string[]>([])

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, MAX_LOG_LINES))
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  const value = useMemo(
    () => ({ logs, addLog, logState: addLog, clearLogs }),
    [addLog, clearLogs, logs]
  )

  return (
    <DebugLogContext.Provider value={value}>{children}</DebugLogContext.Provider>
  )
}

export function useDebugLog(): DebugLogContextValue {
  const ctx = useContext(DebugLogContext)
  if (!ctx) {
    return {
      logs: [],
      addLog: () => {},
      logState: () => {},
      clearLogs: () => {},
    }
  }
  return ctx
}
