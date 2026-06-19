import type { BoothContractClause } from '@/types/database'

function slugId(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `import-${base || 'clause'}-${index + 1}`
}

/** Split exported Google Doc plain text into booth contract clauses. */
export function parseGoogleDocContractText(text: string): BoothContractClause[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const sections = normalized.split(/\n(?=\d+[\.)]\s+|\n[A-Z][^\n]{2,60}\n-{2,}|\n#{1,3}\s+)/)

  const clauses: BoothContractClause[] = []
  for (const chunk of sections) {
    const trimmed = chunk.trim()
    if (trimmed.length < 20) continue

    const lines = trimmed.split('\n')
    const firstLine = lines[0]?.trim() ?? 'Imported clause'
    const title = firstLine.replace(/^\d+[\.)]\s*/, '').slice(0, 120)
    const body = lines.slice(1).join('\n').trim() || trimmed

    clauses.push({
      id: slugId(title, clauses.length),
      title,
      body,
      enabled: true,
      source: 'custom',
      sort_order: clauses.length,
    })
  }

  if (clauses.length === 0) {
    return [
      {
        id: 'import-full-document',
        title: 'Imported contract',
        body: normalized,
        enabled: true,
        source: 'custom',
        sort_order: 0,
      },
    ]
  }

  return clauses
}
