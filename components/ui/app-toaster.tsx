'use client'

import { useEffect, useState } from 'react'
import type { ToasterProps } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

type ToastPosition = NonNullable<ToasterProps['position']>

function resolvePosition(): ToastPosition {
  if (typeof window === 'undefined') return 'top-right'
  return window.matchMedia('(max-width: 640px)').matches ? 'top-center' : 'top-right'
}

/** Site-wide toaster — centered on mobile for readable error dismissal. */
export function AppToaster() {
  const [position, setPosition] = useState<ToastPosition>('top-right')

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)')
    const sync = () => setPosition(resolvePosition())
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return <Toaster richColors position={position} closeButton />
}
