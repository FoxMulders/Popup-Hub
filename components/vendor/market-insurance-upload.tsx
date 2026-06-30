'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { TouchFileInput } from '@/components/ui/touch-file-input'
import { uploadApplicationDocument } from '@/lib/vendor/upload-application-document'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import { FileText, Loader2 } from 'lucide-react'

interface MarketInsuranceUploadProps {
  applicationId: string
  userId: string
  eventName: string
  onComplete?: () => void
}

export function MarketInsuranceUpload({
  applicationId,
  userId,
  eventName,
  onComplete,
}: MarketInsuranceUploadProps) {
  const [uploading, setUploading] = useState(false)

  async function handleUpload(files: FileList | null) {
    const file = files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const supabase = createClient()
      const url = await uploadApplicationDocument(supabase, userId, file, 'insurance', applicationId)

      const res = await fetch(`/api/vendor/applications/${applicationId}/insurance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketInsuranceUrl: url }),
      })

      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to submit insurance proof')
        return
      }

      toast.success('Insurance proof uploaded — your booth is fully approved!')
      onComplete?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-xl border border-harvest-200 bg-harvest-50 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-harvest-700" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-harvest-900">Upload Market Insurance Proof</p>
          <p className="mt-0.5 text-xs text-harvest-800/90">
            Your application for {eventName} was approved, but this market requires proof of insurance
            before your booth is finalized.
          </p>
        </div>
      </div>
      <div>
        <Label className="sr-only">Market insurance document</Label>
        <TouchFileInput
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={handleUpload}
          disabled={uploading}
          label={uploading ? 'Uploading…' : 'Tap to upload insurance proof (PDF or image)'}
        />
        {uploading ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Submitting insurance proof…
          </p>
        ) : null}
      </div>
    </div>
  )
}
