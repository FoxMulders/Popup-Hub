import type { BoothCell, VenueElement } from '@/types/database'
import { displayLabel, isElementOrigin } from '@/lib/booth-planner/venue-elements'

export interface PureLayoutAsset {
  kind: 'booth' | 'fixture'
  col: number
  row: number
  colSpan: number
  rowSpan: number
  label: string
  sublabel?: string
  fixtureType?: string
}

/** Extract only placed physical assets — no empty grid cells. */
export function collectPureLayoutAssets(
  cells: BoothCell[],
  venueElements: VenueElement[]
): PureLayoutAsset[] {
  const assets: PureLayoutAsset[] = []
  const seenBooth = new Set<string>()
  const seenFixture = new Set<string>()

  for (const cell of cells) {
    if (cell.col < 0 || cell.row < 0) continue
    if (seenBooth.has(cell.id)) continue
    seenBooth.add(cell.id)
    assets.push({
      kind: 'booth',
      col: cell.col,
      row: cell.row,
      colSpan: cell.colSpan,
      rowSpan: cell.rowSpan,
      label: cell.vendorName,
      sublabel: `#${cell.boothNumber} · ${cell.categoryName}`,
    })
  }

  for (const el of venueElements) {
    const key = el.id
    if (seenFixture.has(key)) continue
    if (!isElementOrigin(el, el.row, el.col)) continue
    seenFixture.add(key)
    assets.push({
      kind: 'fixture',
      col: el.col,
      row: el.row,
      colSpan: el.colSpan ?? 1,
      rowSpan: el.rowSpan ?? 1,
      label: displayLabel(el),
      fixtureType: el.type,
    })
  }

  return assets
}

export function pureLayoutBounds(assets: PureLayoutAsset[]): {
  cols: number
  rows: number
} {
  if (assets.length === 0) return { cols: 1, rows: 1 }
  let maxC = 0
  let maxR = 0
  for (const a of assets) {
    maxC = Math.max(maxC, a.col + a.colSpan)
    maxR = Math.max(maxR, a.row + a.rowSpan)
  }
  return { cols: maxC, rows: maxR }
}

/** Standalone SVG string — pure assets only, no gridlines or empty cells. */
export function buildPureLayoutSvg(
  assets: PureLayoutAsset[],
  opts?: { cellPx?: number; title?: string }
): string {
  const cellPx = opts?.cellPx ?? 6
  const { cols, rows } = pureLayoutBounds(assets)
  const width = cols * cellPx
  const height = rows * cellPx

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#F5F2EB"/>`,
  ]

  if (opts?.title) {
    parts.push(
      `<text x="4" y="12" font-family="Georgia, serif" font-size="10" fill="#1F1F1E">${escapeXml(opts.title)}</text>`
    )
  }

  for (const a of assets) {
    const x = a.col * cellPx
    const y = a.row * cellPx
    const w = a.colSpan * cellPx
    const h = a.rowSpan * cellPx
    if (a.kind === 'booth') {
      parts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#1F1F1E" stroke-width="1.5"/>`,
        `<text x="${x + w / 2}" y="${y + h / 2 - 2}" text-anchor="middle" font-size="5" font-weight="bold" fill="#1F1F1E">${escapeXml(a.label.slice(0, 18))}</text>`,
        `<text x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle" font-size="4" fill="#1F1F1E">${escapeXml(a.sublabel ?? '')}</text>`
      )
    } else if (a.fixtureType === 'aisle') {
      parts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#1F1F1E" stroke-width="0.75" stroke-dasharray="2 2"/>`
      )
    } else {
      parts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#E8E4DC" stroke="#1F1F1E" stroke-width="1.5"/>`,
        `<text x="${x + w / 2}" y="${y + h / 2 + 2}" text-anchor="middle" font-size="4" font-weight="bold" fill="#1F1F1E">${escapeXml(a.label)}</text>`
      )
    }
  }

  parts.push('</svg>')
  return parts.join('')
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
