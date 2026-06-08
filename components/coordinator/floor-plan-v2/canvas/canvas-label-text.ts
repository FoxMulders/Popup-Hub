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
