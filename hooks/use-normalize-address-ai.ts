'use client'

import { useCallback, useRef } from 'react'

interface NormalizeAddressResult {
  formatted: string
  components: Record<string, string>
}

export function useNormalizeAddressAi() {
  const inflightRef = useRef<AbortController | null>(null)

  const normalizeAddress = useCallback(async (raw: string): Promise<string | null> => {
    const trimmed = raw.trim()
    if (trimmed.length < 8) return null

    inflightRef.current?.abort()
    const controller = new AbortController()
    inflightRef.current = controller

    try {
      const response = await fetch('/api/parse-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: trimmed }),
        signal: controller.signal,
      })

      if (!response.ok) return null

      const data = (await response.json()) as NormalizeAddressResult
      return data.formatted?.trim() || null
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null
      return null
    }
  }, [])

  return { normalizeAddress }
}
