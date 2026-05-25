'use client'

import { createContext, useContext } from 'react'

type PopupLoaderContextValue = {
  playRandomLoader: () => void
}

export const PopupLoaderContext = createContext<PopupLoaderContextValue | null>(null)

export function usePopupLoader() {
  const ctx = useContext(PopupLoaderContext)
  if (!ctx) {
    throw new Error('usePopupLoader must be used within PopupLoaderProvider')
  }
  return ctx
}
