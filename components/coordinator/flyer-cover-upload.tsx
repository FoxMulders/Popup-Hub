'use client'

import { useCallback, useRef, useState } from 'react'
import { Loader2, Sparkles, Upload } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FlyerCoverUploadProps {
  coverImageUrl: string
  onFileSelected: (file: File) => void
  parsing?: boolean
  label?: string
  hint?: string
  className?: string
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

export function FlyerCoverUpload({
  coverImageUrl,
  onFileSelected,
  parsing = false,
  label = 'Cover Image',
  hint = 'JPG, PNG, WebP · upload, paste, or drop · AI reads flyer details',
  className,
}: FlyerCoverUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file || !file.type.startsWith('image/')) return
      onFileSelected(file)
    },
    [onFileSelected]
  )

  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      const file = fileFromClipboardItems(event.clipboardData.items)
      if (!file) return
      event.preventDefault()
      handleFile(file)
    },
    [handleFile]
  )

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setDragActive(false)
      const file = event.dataTransfer.files[0]
      handleFile(file)
    },
    [handleFile]
  )

  return (
    <div className={cn('space-y-1', className)}>
      <Label className="text-sm font-medium">{label}</Label>
      <div
        tabIndex={0}
        role="button"
        onPaste={handlePaste}
        onDragOver={(event) => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={cn(
          'relative flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed p-4 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-forest/40',
          dragActive
            ? 'border-harvest-500 bg-harvest-50/50'
            : 'border-stone-200',
          parsing ? 'pointer-events-none opacity-80' : 'hover:border-harvest-400 hover:bg-canvas'
        )}
      >
        {coverImageUrl ? (
          <img src={coverImageUrl} alt="Cover preview" className="h-16 w-24 rounded-lg object-contain bg-white" />
        ) : (
          <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-canvas">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{coverImageUrl ? 'Change cover' : 'Upload cover or flyer'}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={parsing}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {parsing ? (
        <div
          className="flex items-center gap-2 rounded-lg border border-harvest-200 bg-harvest-50/90 px-3 py-2 text-sm text-harvest-800"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          <Sparkles className="h-4 w-4 shrink-0 text-harvest-600 animate-pulse" aria-hidden />
          <span>✨ AI is reading your poster details…</span>
        </div>
      ) : null}
    </div>
  )
}
