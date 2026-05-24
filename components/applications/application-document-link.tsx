import { FileText, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ApplicationDocumentLinkProps {
  label: string
  url: string | null | undefined
}

export function ApplicationDocumentLink({ label, url }: ApplicationDocumentLinkProps) {
  if (!url) return null

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-canvas px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <FileText className="h-4 w-4 shrink-0 text-harvest-600" aria-hidden />
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-stone-200 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-canvas',
        )}
      >
        View / download
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
    </div>
  )
}
