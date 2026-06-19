'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'

export interface LayoutImageImportResult {
  objects: PlacedObject[]
  roomWidthFt: number
  roomLengthFt: number
  boothCount: number
  notes?: string | null
}

interface LayoutImageImportButtonProps {
  roomWidthFt?: number
  roomLengthFt?: number
  tableLengthFt?: number
  disabled?: boolean
  onImported: (result: LayoutImageImportResult) => void | Promise<void>
  compact?: boolean
}

async function importLayoutImageFile(
  file: File,
  roomWidthFt?: number,
  roomLengthFt?: number,
  tableLengthFt?: number
): Promise<LayoutImageImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  if (roomWidthFt) formData.append('roomWidthFt', String(roomWidthFt))
  if (roomLengthFt) formData.append('roomLengthFt', String(roomLengthFt))
  if (tableLengthFt) formData.append('tableLengthFt', String(tableLengthFt))

  const res = await fetch('/api/coordinator/layout/import-image', {
    method: 'POST',
    body: formData,
  })

  const json = (await res.json()) as LayoutImageImportResult & { error?: string; code?: string }
  if (!res.ok) {
    throw new Error(json.error ?? 'Import failed')
  }
  return json
}

function fileFromClipboardItems(items: DataTransferItemList): File | null {
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) return file
    }
  }
  return null
}

export function LayoutImageImportButton({
  roomWidthFt,
  roomLengthFt,
  tableLengthFt,
  disabled = false,
  onImported,
  compact = false,
}: LayoutImageImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  const processFile = useCallback(
    async (file: File | undefined) => {
      if (!file || !file.type.startsWith('image/')) return
      setLoading(true)
      try {
        const result = await importLayoutImageFile(file, roomWidthFt, roomLengthFt, tableLengthFt)
        if (result.boothCount === 0 && result.objects.length === 0) {
          toast.error(result.notes ?? 'No booths detected — try a clearer floor plan photo')
          return
        }
        await onImported(result)
        toast.success(
          `Imported ${result.boothCount} booth${result.boothCount === 1 ? '' : 's'} from image`
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not import layout image')
      } finally {
        setLoading(false)
      }
    },
    [onImported, roomLengthFt, roomWidthFt, tableLengthFt]
  )

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (disabled || loading) return
      const file = event.clipboardData ? fileFromClipboardItems(event.clipboardData.items) : null
      if (!file) return
      event.preventDefault()
      void processFile(file)
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [disabled, loading, processFile])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 gap-1.5"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
        title="Import booths from a photo of a past market layout (pick file or paste image)"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ImagePlus className="h-3.5 w-3.5" />
        )}
        {compact ? 'Import photo' : 'Import layout photo'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void processFile(e.target.files?.[0])}
      />
    </>
  )
}
