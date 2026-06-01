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

const MAX_LOG_LINES = 50

export interface DebugLogContextValue {
  logs: string[]
  addLog: (message: string) => void
  /** Alias for `addLog` — geometry coordinate / placement events. */
  logState: (message: string) => void
  logError: (message: string, err?: unknown) => void
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

  const logError = useCallback(
    (message: string, err?: unknown) => {
      const detail =
        err instanceof Error
          ? err.message
          : err != null
            ? String(err)
            : ''
      addLog(detail ? `${message} — ${detail}` : message)
    },
    [addLog]
  )

  const value = useMemo(
    () => ({ logs, addLog, logState: addLog, logError, clearLogs }),
    [addLog, clearLogs, logError, logs]
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
      logError: () => {},
      clearLogs: () => {},
    }
  }
  return ctx
}
