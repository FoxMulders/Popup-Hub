'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type LayoutSaveStatus = 'idle' | 'saving' | 'saved'

interface DashboardLayoutSaveContextValue {
  status: LayoutSaveStatus
  /** Debounced autosave — shows saving immediately, saved after delay. */
  scheduleAutosave: (save: () => void, delayMs?: number) => void
}

const DashboardLayoutSaveContext =
  createContext<DashboardLayoutSaveContextValue | null>(null)

const SAVED_DISPLAY_MS = 3500
const SAVING_DEBOUNCE_MS = 400
const SAVED_HOLD_MS = 1000

export function DashboardLayoutSaveProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LayoutSaveStatus>('idle')
  const saveTimerRef = useRef<number | null>(null)
  const fadeTimerRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }, [])

  const scheduleAutosave = useCallback(
    (save: () => void, delayMs = SAVING_DEBOUNCE_MS) => {
      clearTimers()
      if (fadeTimerRef.current != null) {
        window.clearTimeout(fadeTimerRef.current)
        fadeTimerRef.current = null
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null
        setStatus('saving')
        save()
        fadeTimerRef.current = window.setTimeout(() => {
          fadeTimerRef.current = null
          setStatus('saved')
          fadeTimerRef.current = window.setTimeout(() => {
            fadeTimerRef.current = null
            setStatus('idle')
          }, SAVED_DISPLAY_MS)
        }, SAVED_HOLD_MS)
      }, delayMs)
    },
    [clearTimers]
  )

  useEffect(() => {
    return () => {
      clearTimers()
      if (fadeTimerRef.current != null) {
        window.clearTimeout(fadeTimerRef.current)
      }
    }
  }, [clearTimers])

  const value = useMemo(
    () => ({ status, scheduleAutosave }),
    [scheduleAutosave, status]
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
