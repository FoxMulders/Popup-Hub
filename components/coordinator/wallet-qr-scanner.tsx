'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Loader2, X } from 'lucide-react'
import { parseWalletTopUpQrPayload } from '@/lib/wallet/wallet-qr'

interface WalletQrScannerProps {
  open: boolean
  onClose: () => void
  onScan: (payload: string) => void
}

export function WalletQrScanner({ open, onClose, onScan }: WalletQrScannerProps) {
  const regionId = useId().replace(/:/g, '')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onScanRef.current = onScan
    onCloseRef.current = onClose
  }, [onScan, onClose])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    const scanner = new Html5Qrcode(regionId)
    scannerRef.current = scanner
    setStarting(true)
    setError(null)

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
        (decoded) => {
          const userId = parseWalletTopUpQrPayload(decoded)
          if (!userId) return
          onScanRef.current(decoded)
          void scanner.stop().finally(() => {
            scannerRef.current = null
            onCloseRef.current()
          })
        },
        () => {
          /* ignore scan miss frames */
        }
      )
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : 'Could not open the camera for scanning'
        setError(message)
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
        <p className="text-sm font-medium">Scan patron wallet QR</p>
        <Button type="button" variant="ghost" size="icon" className="text-white" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 pb-8">
        <div
          id={regionId}
          className="w-full max-w-sm overflow-hidden rounded-2xl border-2 border-white/30"
        />
        {starting ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        ) : null}
        {error ? (
          <p className="mt-4 max-w-sm text-center text-sm text-red-300">{error}</p>
        ) : (
          <p className="mt-4 max-w-sm text-center text-sm text-white/80">
            Point the camera at the patron&apos;s wallet QR code. Works best in good lighting.
          </p>
        )}
      </div>
    </div>
  )
}
