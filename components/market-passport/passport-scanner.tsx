'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, PartyPopper, X } from 'lucide-react'
import { parsePassportScanPayload } from '@/lib/passport/passport-token'
import { queuePassportScan } from '@/lib/pwa/passport-offline-queue'

interface PassportProgress {
  scannedCount: number
  vendorsRequired: number
  bonusEligible: boolean
  scannedVendorIds?: string[]
}

interface PassportScannerProps {
  open: boolean
  onClose: () => void
  onScanComplete: (result: {
    vendorName: string | null
    alreadyScanned: boolean
    progress: PassportProgress
  }) => void
}

type ScanFeedback =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; vendorName: string | null; alreadyScanned: boolean; queued?: boolean }
  | { kind: 'error'; message: string }

export function PassportScanner({ open, onClose, onScanComplete }: PassportScannerProps) {
  const regionId = useId().replace(/:/g, '')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const onCloseRef = useRef(onClose)
  const onScanCompleteRef = useRef(onScanComplete)
  const [starting, setStarting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<ScanFeedback>({ kind: 'idle' })
  const submittingRef = useRef(false)

  useEffect(() => {
    onCloseRef.current = onClose
    onScanCompleteRef.current = onScanComplete
  }, [onClose, onScanComplete])

  useEffect(() => {
    if (!open) {
      setFeedback({ kind: 'idle' })
      setCameraError(null)
      submittingRef.current = false
      return
    }

    let cancelled = false
    const scanner = new Html5Qrcode(regionId)
    scannerRef.current = scanner
    setStarting(true)
    setCameraError(null)

    async function handleDecoded(decoded: string) {
      if (submittingRef.current) return
      const token = parsePassportScanPayload(decoded)
      if (!token) return

      submittingRef.current = true
      setFeedback({ kind: 'submitting' })

      try {
        const res = await fetch('/api/passport/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const json = (await res.json()) as {
          error?: string
          vendorName?: string | null
          alreadyScanned?: boolean
          progress?: PassportProgress
        }

        if (!res.ok) {
          setFeedback({ kind: 'error', message: json.error ?? 'Scan failed' })
          submittingRef.current = false
          return
        }

        setFeedback({
          kind: 'success',
          vendorName: json.vendorName ?? null,
          alreadyScanned: !!json.alreadyScanned,
        })

        if (json.progress) {
          onScanCompleteRef.current({
            vendorName: json.vendorName ?? null,
            alreadyScanned: !!json.alreadyScanned,
            progress: json.progress,
          })
        }

        await scanner.stop().catch(() => {})
        scannerRef.current = null
      } catch {
        try {
          await queuePassportScan(token)
          if ('serviceWorker' in navigator && 'SyncManager' in window) {
            const registration = await navigator.serviceWorker.ready
            const syncManager = (
              registration as ServiceWorkerRegistration & {
                sync?: { register: (tag: string) => Promise<void> }
              }
            ).sync
            await syncManager?.register('passport-scan-sync')
          }
          setFeedback({
            kind: 'success',
            vendorName: null,
            alreadyScanned: false,
            queued: true,
          })
        } catch {
          setFeedback({ kind: 'error', message: 'Network error — try again' })
          submittingRef.current = false
          return
        }
      }
    }

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
        (decoded) => {
          void handleDecoded(decoded)
        },
        () => {
          /* ignore scan miss frames */
        }
      )
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : 'Could not open the camera for scanning'
        setCameraError(message)
      })
      .finally(() => {
        if (!cancelled) setStarting(false)
      })

    return () => {
      cancelled = true
      if (scannerRef.current) {
        void scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [open, regionId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm font-medium">Scan vendor passport QR</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-white"
          onClick={() => onCloseRef.current()}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-4 pb-8">
        {feedback.kind === 'success' ? (
          <div className="flex max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-lg">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sage-100">
              {feedback.alreadyScanned ? (
                <CheckCircle2 className="h-8 w-8 text-sage-600" />
              ) : (
                <PartyPopper className="h-8 w-8 text-harvest-600" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">
                {feedback.queued
                  ? 'Scan saved offline'
                  : feedback.alreadyScanned
                    ? 'Already checked off'
                    : 'Vendor checked off! 🎉'}
              </p>
              {feedback.queued ? (
                <p className="text-sm text-muted-foreground">
                  We&apos;ll sync this stamp when you&apos;re back online.
                </p>
              ) : feedback.vendorName ? (
                <p className="text-sm text-muted-foreground">{feedback.vendorName}</p>
              ) : null}
            </div>
            <Button type="button" onClick={() => onCloseRef.current()}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div
              id={regionId}
              className="w-full max-w-sm overflow-hidden rounded-2xl border-2 border-white/30"
            />
            {starting || feedback.kind === 'submitting' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
                {feedback.kind === 'submitting' ? (
                  <p className="text-sm text-white/90">Recording scan…</p>
                ) : null}
              </div>
            ) : null}
            {feedback.kind === 'error' ? (
              <div className="mt-4 max-w-sm space-y-3 text-center">
                <p className="text-sm text-red-300">{feedback.message}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFeedback({ kind: 'idle' })
                    submittingRef.current = false
                  }}
                >
                  Try again
                </Button>
              </div>
            ) : cameraError ? (
              <p className="mt-4 max-w-sm text-center text-sm text-red-300">{cameraError}</p>
            ) : (
              <p className="mt-4 max-w-sm text-center text-sm text-white/80">
                Point your camera at the QR code displayed at the vendor&apos;s booth.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
