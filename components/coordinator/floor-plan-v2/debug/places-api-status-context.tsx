'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type PlacesApiStatus = 'idle' | 'API_SUCCESS' | 'API_ERROR'

export interface PlacesApiStatusContextValue {
  status: PlacesApiStatus
  reportPlacesApi: (success: boolean) => void
}

const PlacesApiStatusContext = createContext<PlacesApiStatusContextValue | null>(
  null
)

export function PlacesApiStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PlacesApiStatus>('idle')

  const reportPlacesApi = useCallback((success: boolean) => {
    setStatus(success ? 'API_SUCCESS' : 'API_ERROR')
  }, [])

  const value = useMemo(
    () => ({ status, reportPlacesApi }),
    [reportPlacesApi, status]
  )

  return (
    <PlacesApiStatusContext.Provider value={value}>
      {children}
    </PlacesApiStatusContext.Provider>
  )
}

export function usePlacesApiStatus(): PlacesApiStatusContextValue {
  const ctx = useContext(PlacesApiStatusContext)
  if (!ctx) {
    return {
      status: 'idle',
      reportPlacesApi: () => {},
    }
  }
  return ctx
}
