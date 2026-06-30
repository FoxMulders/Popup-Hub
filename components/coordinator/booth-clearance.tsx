'use client'

/**
 * Fraud-resistant checkout: camera-only capture via getUserMedia + canvas.
 * No file input — vendors cannot upload gallery photos.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from '@/lib/toast'
import { Camera, RotateCcw, CheckCircle2, ImageIcon } from 'lucide-react'
import { getClearanceInstructions } from '@/lib/booth-clearance-policy'
import type { BoothApplication, BoothClearancePolicy, Profile, VendorPassport } from '@/types/database'

type ClearanceApplication = Omit<BoothApplication, 'vendor' | 'passport' | 'category' | 'event'> & {
  vendor: Profile
  passport: VendorPassport | null
}

interface BoothClearanceProps {
  application: ClearanceApplication
  clearancePolicy: BoothClearancePolicy
  onCleared: (photoUrl: string | null) => void
}

interface BoothClearanceDialogInnerProps {
  application: ClearanceApplication
  clearancePolicy: BoothClearancePolicy
  onCleared: (photoUrl: string | null) => void
  onClose: () => void
}

function BoothClearanceDialogInner({
  application,
  clearancePolicy,
  onCleared,
  onClose,
}: BoothClearanceDialogInnerProps) {
  const instructions = getClearanceInstructions(clearancePolicy)
  const supabase = createClient()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [phase, setPhase] = useState<'camera' | 'preview' | 'done'>('camera')
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [uploading, setUploading] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const businessName = application.passport?.business_name ?? application.vendor.full_name
  const boothLabel = application.booth_number != null ? `Booth #${application.booth_number}` : 'No Booth'

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch {
      setCameraError('Camera access denied. Please allow camera permissions and try again.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (phase === 'camera') {
      startCamera()
    }
    return () => {
      if (phase === 'camera') stopCamera()
    }
  }, [phase, startCamera, stopCamera])

  // Stop camera when we move away from camera phase
  useEffect(() => {
    if (phase !== 'camera') stopCamera()
  }, [phase, stopCamera])

  function capturePhoto() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const boothId =
      application.booth_number != null ? `#${application.booth_number}` : application.id.slice(0, 8)
    const timestampUtc = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
    const watermarkText = `${businessName} | Booth ${boothId} | Checked Out ${timestampUtc}`
    const fontSize = Math.max(14, Math.floor(canvas.width / 55))
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.shadowColor = 'rgba(0,0,0,0.8)'
    ctx.shadowBlur = 6
    ctx.fillStyle = 'white'
    ctx.fillText(watermarkText, 12, canvas.height - 14)
    ctx.shadowBlur = 0

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setCapturedDataUrl(dataUrl)

    canvas.toBlob(
      (blob) => {
        if (blob) setCapturedBlob(blob)
      },
      'image/jpeg',
      0.92
    )

    setPhase('preview')
  }

  function retake() {
    setCapturedDataUrl(null)
    setCapturedBlob(null)
    setPhase('camera')
  }

  async function confirmClearance() {
    if (!capturedBlob) return
    setUploading(true)
    try {
      const fileName = `${application.event_id}/${application.id}_${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('booth-clearance-photos')
        .upload(fileName, capturedBlob, { contentType: 'image/jpeg', upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('booth-clearance-photos')
        .getPublicUrl(fileName)

      const photoUrl = urlData.publicUrl

      const now = new Date().toISOString()
      const { error: dbError } = await supabase
        .from('booth_applications')
        .update({
          booth_cleared: true,
          booth_cleared_photo_url: photoUrl,
          booth_cleared_at: now,
        })
        .eq('id', application.id)

      if (dbError) throw dbError

      onCleared(photoUrl)
      setPhase('done')
      toast.success('Booth clearance confirmed ✓')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save clearance. Check bucket permissions.')
    } finally {
      setUploading(false)
    }
  }

  if (phase === 'done') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-sage-600" />
        <p className="font-heading font-semibold text-foreground">Booth Cleared!</p>
        <p className="text-sm text-muted-foreground">{businessName} — {boothLabel}</p>
        {capturedDataUrl && (
          <img src={capturedDataUrl} alt="Clearance photo" className="rounded-lg max-h-40 object-cover border" />
        )}
        <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
      </div>
    )
  }

  if (phase === 'preview' && capturedDataUrl) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground font-medium">Review photo before confirming:</p>
        <div className="relative rounded-xl overflow-hidden border border-stone-200">
          <img src={capturedDataUrl} alt="Clearance preview" className="w-full object-cover max-h-64" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={retake} className="gap-1.5 flex-1">
            <RotateCcw className="h-4 w-4" />
            Retake
          </Button>
          <Button
            size="sm"
            onClick={confirmClearance}
            disabled={uploading}
            className="gap-1.5 flex-1 min-h-11"
          >
            <CheckCircle2 className="h-4 w-4" />
            {uploading ? 'Saving…' : 'Confirm Clearance'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg border p-3 text-sm ${
          clearancePolicy === 'pack_furniture'
            ? 'bg-terracotta-50 border-terracotta-200 text-terracotta-800'
            : 'bg-harvest-50 border-harvest-200 text-harvest-700'
        }`}
      >
        <p className="font-semibold mb-1">{instructions.title}</p>
        <p>{instructions.body}</p>
      </div>

      {cameraError ? (
        <div className="rounded-xl border-2 border-terracotta-200 bg-terracotta-50 p-4 text-sm text-terracotta-800 text-center space-y-2">
          <p>{cameraError}</p>
          <Button variant="outline" size="sm" onClick={startCamera}>
            Try Again
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-black border border-stone-200 aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 right-2 text-[10px] text-white/70 text-center bg-black/30 rounded px-2 py-0.5">
              {businessName} · {boothLabel}
            </div>
          </div>
          <Button
            onClick={capturePhoto}
            className="w-full gap-2 min-h-11"
          >
            <Camera className="h-4 w-4" />
            Capture Photo
          </Button>
        </div>
      )}

      {/* Hidden canvas for watermarking */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

export function BoothClearance({ application, clearancePolicy, onCleared }: BoothClearanceProps) {
  const [open, setOpen] = useState(false)
  const hasPhoto = application.booth_cleared && application.booth_cleared_photo_url
  const requiresPhoto = getClearanceInstructions(clearancePolicy).requiresPhoto

  if (!requiresPhoto) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          hasPhoto ? (
            <Button variant="outline" size="sm" className="gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
              Re-capture
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-1.5 min-h-11"
            >
              <Camera className="h-3.5 w-3.5" />
              Photo verify
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              Booth Clearance — {application.passport?.business_name ?? application.vendor.full_name}
            </DialogTitle>
          </div>
        </DialogHeader>
        <BoothClearanceDialogInner
          application={application}
          clearancePolicy={clearancePolicy}
          onCleared={onCleared}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
