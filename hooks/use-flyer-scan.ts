'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { applyParsedFlyer } from '@/lib/flyer/apply-parsed-flyer'
import type { FlyerFieldKey, FlyerFormHandlers, ParsedFlyerResponse } from '@/lib/flyer/types'

interface ParseFlyerApiResponse extends ParsedFlyerResponse {
  error?: string
  meta?: { source?: string }
}

const FLYER_PARSE_FALLBACK =
  'Could not automatically read flyer details, but you can still type them in manually.'

function flyerParseErrorMessage(apiError: string | undefined, noFieldsMapped: boolean): string {
  if (apiError?.trim()) {
    return `${apiError.trim()} You can still enter details manually.`
  }
  if (noFieldsMapped) {
    return 'We read your flyer but could not map any fields to the form. Please enter details manually.'
  }
  return FLYER_PARSE_FALLBACK
}

export function useFlyerScan() {
  const [parsing, setParsing] = useState(false)
  const [autoFilledFields, setAutoFilledFields] = useState<Set<FlyerFieldKey>>(new Set())
  const scanGeneration = useRef(0)

  const clearAutoFilledHighlight = useCallback(() => {
    setAutoFilledFields(new Set())
  }, [])

  const scanFlyer = useCallback(
    async (file: File, handlers: FlyerFormHandlers): Promise<boolean> => {
      const generation = ++scanGeneration.current
      setParsing(true)

      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/parse-flyer', {
          method: 'POST',
          body: formData,
        })

        const json = (await res.json()) as ParseFlyerApiResponse

        if (generation !== scanGeneration.current) return false

        if (!res.ok || json.error) {
          toast.error(flyerParseErrorMessage(json.error, false))
          return false
        }

        const filled = applyParsedFlyer(json, handlers)
        if (filled.size === 0) {
          toast.error(flyerParseErrorMessage(undefined, true))
          return false
        }

        setAutoFilledFields(filled)
        toast.success('Form fields populated from your flyer! Please review for accuracy.')

        window.setTimeout(() => {
          setAutoFilledFields((prev) => {
            if (prev === filled) return new Set()
            return prev
          })
        }, 12_000)

        return true
      } catch {
        if (generation === scanGeneration.current) {
          toast.error(FLYER_PARSE_FALLBACK)
        }
        return false
      } finally {
        if (generation === scanGeneration.current) {
          setParsing(false)
        }
      }
    },
    []
  )

  return {
    parsing,
    autoFilledFields,
    scanFlyer,
    clearAutoFilledHighlight,
  }
}
