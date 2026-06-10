/**
 * Dynamic SVG label sizing — shrink font or ellipsis when text overflows container.
 */

export interface FittedCanvasLabel {
  text: string
  fontSize: number
}

export interface FitTextInContainerOptions {
  baseFontSize?: number
  minFontSize?: number
  padX?: number
  padY?: number
  charWidthRatio?: number
}

export interface WrappedCanvasLabel {
  lines: string[]
  fontSize: number
  lineHeight: number
}

/**
 * Word-aware wrap — prefers multiple lines over ellipsis when height allows.
 */
export function wrapTextInContainer(
  text: string,
  innerWidthPx: number,
  innerHeightPx: number,
  options: FitTextInContainerOptions = {}
): WrappedCanvasLabel {
  const baseFontSize = options.baseFontSize ?? 11
  const minFontSize = options.minFontSize ?? 6
  const padX = options.padX ?? 4
  const padY = options.padY ?? 2
  const charWidthRatio = options.charWidthRatio ?? 0.58

  const trimmed = text.trim()
  if (!trimmed) {
    return { lines: [], fontSize: baseFontSize, lineHeight: baseFontSize + 2 }
  }

  const availW = Math.max(1, innerWidthPx - padX * 2)
  const availH = Math.max(1, innerHeightPx - padY * 2)

  for (let fs = baseFontSize; fs >= minFontSize; fs -= 0.5) {
    const charW = fs * charWidthRatio
    const lineHeight = fs + 2
    const maxLines = Math.max(1, Math.floor(availH / lineHeight))
    const maxCharsPerLine = Math.max(1, Math.floor(availW / charW))

    const words = trimmed.split(/\s+/)
    const lines: string[] = []
    let current = ''

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (candidate.length <= maxCharsPerLine) {
        current = candidate
      } else {
        if (current) lines.push(current)
        current = word.length > maxCharsPerLine
          ? truncateToWidth(word, maxCharsPerLine)
          : word
      }
    }
    if (current) lines.push(current)

    if (lines.length <= maxLines) {
      return { lines, fontSize: fs, lineHeight }
    }
  }

  const fs = minFontSize
  const charW = fs * charWidthRatio
  const maxChars = Math.max(1, Math.floor(availW / charW))
  return {
    lines: [truncateToWidth(trimmed, maxChars)],
    fontSize: fs,
    lineHeight: fs + 2,
  }
}

const ELLIPSIS = '…'

function truncateToWidth(
  text: string,
  maxChars: number
): string {
  if (text.length <= maxChars) return text
  if (maxChars <= 1) return ELLIPSIS
  return `${text.slice(0, maxChars - 1)}${ELLIPSIS}`
}

/**
 * Fit `text` inside `innerWidthPx × innerHeightPx` by lowering font size
 * down to `minFontSize`, then applying ellipsis truncation.
 */
export function fitTextInContainer(
  text: string,
  innerWidthPx: number,
  innerHeightPx: number,
  options: FitTextInContainerOptions = {}
): FittedCanvasLabel {
  const baseFontSize = options.baseFontSize ?? 11
  const minFontSize = options.minFontSize ?? 6
  const padX = options.padX ?? 4
  const padY = options.padY ?? 2
  const charWidthRatio = options.charWidthRatio ?? 0.58

  const trimmed = text.trim()
  if (!trimmed) return { text: '', fontSize: baseFontSize }

  const availW = Math.max(1, innerWidthPx - padX * 2)
  const availH = Math.max(1, innerHeightPx - padY * 2)

  for (let fs = baseFontSize; fs >= minFontSize; fs -= 0.5) {
    const charW = fs * charWidthRatio
    const maxChars = Math.floor(availW / charW)
    const lineH = fs + 2
    if (lineH > availH) continue
    if (trimmed.length * charW <= availW) {
      return { text: trimmed, fontSize: fs }
    }
    if (maxChars >= 2) {
      return { text: truncateToWidth(trimmed, maxChars), fontSize: fs }
    }
  }

  const charW = minFontSize * charWidthRatio
  const maxChars = Math.max(1, Math.floor(availW / charW))
  return {
    text: truncateToWidth(trimmed, maxChars),
    fontSize: minFontSize,
  }
}
