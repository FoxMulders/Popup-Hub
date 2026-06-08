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

function applyMapView(
  map: google.maps.Map,
  lat: number,
  lng: number,
  pinDropped: boolean,
  zoom: number
) {
  const target = { lat, lng }
  map.panTo(target)
  if (pinDropped) {
    map.setZoom(zoom)
  }
  // Advanced Markers may not paint until the map gets a resize/idle cycle
  // (common when the container animates in or coords arrive before tiles load).
  window.requestAnimationFrame(() => {
    google.maps.event.trigger(map, 'resize')
    map.panTo(target)
  })
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
  const idleListenerRef = useRef<google.maps.MapsEventListener | null>(null)

  useEffect(() => {
    if (!map) return

    const prev = prevCoords.current
    const coordsChanged =
      !prev || Math.abs(prev.lat - lat) > 1e-7 || Math.abs(prev.lng - lng) > 1e-7
    const pinJustDropped = zoomOnPinDrop && pinDropped && !prevPinDropped.current

    if (coordsChanged || pinJustDropped) {
      applyMapView(map, lat, lng, pinDropped, zoom)
      prevCoords.current = { lat, lng }

      idleListenerRef.current?.remove()
      idleListenerRef.current = map.addListener('idle', () => {
        google.maps.event.trigger(map, 'resize')
        map.panTo({ lat, lng })
        idleListenerRef.current?.remove()
        idleListenerRef.current = null
      })
    }

    prevPinDropped.current = pinDropped

    return () => {
      idleListenerRef.current?.remove()
      idleListenerRef.current = null
    }
  }, [map, lat, lng, pinDropped, zoomOnPinDrop, zoom])

  return null
}
