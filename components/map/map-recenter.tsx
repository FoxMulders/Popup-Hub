'use client'

import { useEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'

interface MapRecenterProps {
  lat: number
  lng: number
  /** When true, zoom in after the pin is first dropped. */
  zoomOnPinDrop?: boolean
  pinDropped?: boolean
  zoom?: number
}

/** Pan the map when coordinates change externally — without locking drag/pan via a controlled center. */
export function MapRecenter({
  lat,
  lng,
  zoomOnPinDrop = false,
  pinDropped = false,
  zoom = 14,
}: MapRecenterProps) {
  const map = useMap()
  const prevPinDropped = useRef(pinDropped)
  const prevCoords = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!map) return

    const prev = prevCoords.current
    const coordsChanged =
      !prev || Math.abs(prev.lat - lat) > 1e-7 || Math.abs(prev.lng - lng) > 1e-7

    if (coordsChanged) {
      map.panTo({ lat, lng })
      prevCoords.current = { lat, lng }
      if (pinDropped) {
        map.setZoom(zoom)
      }
    }

    if (zoomOnPinDrop && pinDropped && !prevPinDropped.current) {
      map.setZoom(zoom)
    }

    prevPinDropped.current = pinDropped
  }, [map, lat, lng, pinDropped, zoomOnPinDrop, zoom])

  return null
}
