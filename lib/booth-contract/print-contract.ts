import type { BoothContractClause } from '@/types/database'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function openBoothContractForPrint(input: {
  clauses: BoothContractClause[]
  pdfUrl?: string | null
  eventName?: string
}): void {
  if (input.pdfUrl) {
    window.open(input.pdfUrl, '_blank', 'noopener,noreferrer')
    return
  }

  const title = input.eventName?.trim() ? `Booth contract — ${input.eventName.trim()}` : 'Booth contract'
  const body = input.clauses
    .map(
      (clause) =>
        `<section style="margin-bottom:1.25rem"><h2 style="font-size:14px;margin:0 0 6px">${escapeHtml(clause.title)}</h2><p style="font-size:13px;line-height:1.5;margin:0;white-space:pre-wrap">${escapeHtml(clause.body)}</p></section>`
    )
    .join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family:system-ui,sans-serif;padding:24px;color:#1c1917"><h1 style="font-size:18px;margin:0 0 16px">${escapeHtml(title)}</h1>${body}<p style="margin-top:32px;font-size:12px;color:#57534e">Sign above and return to the market coordinator.</p></body></html>`

  const printWindow = window.open('', '_blank', 'noopener,noreferrer')
  if (!printWindow) return
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}
