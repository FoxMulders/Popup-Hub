'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from '@/lib/toast'
import { showFlyerParseErrorToast } from '@/components/coordinator/flyer-parse-error-toast'
import { applyParsedFlyer } from '@/lib/flyer/apply-parsed-flyer'
import { compressImageForUpload } from '@/lib/media/compress-image-for-upload'
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
        const prepared = await compressImageForUpload(file, 5 * 1024 * 1024)
        const formData = new FormData()
        formData.append('file', prepared)

        const res = await fetch('/api/parse-flyer', {
          method: 'POST',
          body: formData,
        })

        let json: ParseFlyerApiResponse
        try {
          json = (await res.json()) as ParseFlyerApiResponse
        } catch (parseErr) {
          console.warn('[flyer-scan] Could not parse flyer API response', parseErr)
          showFlyerParseErrorToast(FLYER_PARSE_FALLBACK)
          return false
        }

        if (generation !== scanGeneration.current) return false

        if (!res.ok || json.error) {
          console.warn('[flyer-scan] Flyer parse API returned an error', {
            status: res.status,
            error: json.error,
          })
          showFlyerParseErrorToast(flyerParseErrorMessage(json.error, false))
          return false
        }

        let filled: Set<FlyerFieldKey>
        try {
          filled = applyParsedFlyer(json, handlers)
        } catch (applyErr) {
          console.warn('[flyer-scan] Failed to apply parsed flyer fields to the form', applyErr)
          showFlyerParseErrorToast(FLYER_PARSE_FALLBACK)
          return false
        }

        if (filled.size === 0) {
          console.warn('[flyer-scan] Flyer parsed but no form fields could be mapped')
          showFlyerParseErrorToast(flyerParseErrorMessage(undefined, true))
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
      } catch (err) {
        if (generation === scanGeneration.current) {
          console.warn('[flyer-scan] Flyer scan failed unexpectedly', err)
          showFlyerParseErrorToast(FLYER_PARSE_FALLBACK)
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
