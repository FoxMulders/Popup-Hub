'use client'

import { APIProvider, type APIProviderProps } from '@vis.gl/react-google-maps'
import type { ReactNode } from 'react'

const WIZARD_MAP_LIBRARIES: NonNullable<APIProviderProps['libraries']> = [
  'places',
]

/**
 * Loads Maps JS API with the Places library required for venue/address autocomplete.
 */
export function WizardPlacesApiProviderQa({
  apiKey,
  children,
}: {
  apiKey: string
  children: ReactNode
}) {
  return (
    <APIProvider apiKey={apiKey} libraries={WIZARD_MAP_LIBRARIES}>
      {children}
    </APIProvider>
  )
}
