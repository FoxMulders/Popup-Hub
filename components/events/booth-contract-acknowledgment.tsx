'use client'

import { ExternalLink, FileText } from 'lucide-react'
import type { BoothContractClause } from '@/types/database'

interface BoothContractAcknowledgmentProps {
  clauses: BoothContractClause[]
  pdfUrl?: string | null
  updatedAt?: string | null
  className?: string
}

export function BoothContractAcknowledgment({
  clauses,
  pdfUrl,
  updatedAt,
  className,
}: BoothContractAcknowledgmentProps) {
  if (clauses.length === 0 && !pdfUrl) return null

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Digital booth contract</p>
        {updatedLabel ? (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Updated {updatedLabel}
          </span>
        ) : null}
      </div>
      <div className="max-h-48 space-y-3 overflow-y-auto rounded-lg border bg-white p-3">
        {clauses.map((clause) => (
          <div key={clause.id}>
            <p className="text-xs font-semibold text-foreground">{clause.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {clause.body}
            </p>
          </div>
        ))}
      </div>
      {pdfUrl ? (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-harvest-700 hover:underline"
        >
          <FileText className="h-3.5 w-3.5" />
          View full contract PDF
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  )
}
