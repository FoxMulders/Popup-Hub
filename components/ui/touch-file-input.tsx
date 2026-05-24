'use client'

import { useId, useRef } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TouchFileInputProps {
  accept?: string
  multiple?: boolean
  onChange: (files: FileList | null) => void
  disabled?: boolean
  className?: string
  children?: React.ReactNode
  preview?: React.ReactNode
  label?: string
}

/** Mobile-friendly file picker — uses visible button + programmatic click for reliable touch. */
export function TouchFileInput({
  accept = 'image/*',
  multiple = false,
  onChange,
  disabled,
  className,
  children,
  preview,
  label = 'Upload photo',
}: TouchFileInputProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => onChange(e.target.files)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-200 p-4',
          'transition hover:border-forest/40 active:scale-[0.99] touch-manipulation',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
        aria-labelledby={id}
      >
        {preview ?? <Upload className="h-8 w-8 text-muted-foreground" />}
        {children ?? (
          <span className="text-xs text-muted-foreground text-center">{label}</span>
        )}
      </button>
    </div>
  )
}
