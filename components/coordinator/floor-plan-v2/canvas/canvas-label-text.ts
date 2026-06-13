/**
 * Dynamic SVG label sizing — grow to fill the box when text is short,
 * shrink or ellipsis when it overflows.
 */

export interface FittedCanvasLabel {
  text: string
  fontSize: number
}

export interface FitTextInContainerOptions {
  baseFontSize?: number
  minFontSize?: number
  maxFontSize?: number
  padX?: number
  padY?: number
  charWidthRatio?: number
}

export interface WrappedCanvasLabel {
  lines: string[]
  fontSize: number
  lineHeight: number
}

const ELLIPSIS = '…'

function truncateToWidth(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  if (maxChars <= 1) return ELLIPSIS
  return `${text.slice(0, maxChars - 1)}${ELLIPSIS}`
}

function normalizeLabelWords(text: string): string[] {
  const normalized = text.trim().replace(/\s*[—–]\s*/g, ' ')
  return normalized.split(/\s+/).filter(Boolean)
}

function wrapWordsAtSize(
  words: string[],
  fs: number,
  availW: number,
  charWidthRatio: number
): string[] {
  const charW = fs * charWidthRatio
  const maxCharsPerLine = Math.max(1, Math.floor(availW / charW))
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxCharsPerLine) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current =
        word.length > maxCharsPerLine
          ? truncateToWidth(word, maxCharsPerLine)
          : word
    }
  }
  if (current) lines.push(current)
  return lines
}

function wrappedBlockHeight(lineCount: number, fs: number): number {
  return lineCount * (fs + 2)
}

function defaultMaxFontSize(
  trimmed: string,
  availW: number,
  availH: number,
  charWidthRatio: number,
  baseFontSize: number,
  minFontSize: number
): number {
  const byHeight = Math.max(minFontSize, availH - 2)
  const bySingleGlyph = availW / charWidthRatio
  const byFullLine =
    trimmed.length > 0
      ? availW / (trimmed.length * charWidthRatio)
      : byHeight
  const words = normalizeLabelWords(trimmed)
  const longestWordLen = words.reduce(
    (max, word) => Math.max(max, word.length),
    trimmed.length
  )
  const byLongestWord =
    longestWordLen > 0
      ? availW / (longestWordLen * charWidthRatio)
      : byHeight

  return Math.max(
    baseFontSize,
    Math.min(byHeight, bySingleGlyph, byFullLine, byLongestWord)
  )
}

/**
 * Word-aware wrap — prefers multiple lines over ellipsis when height allows.
 * Uses the largest font size that still fits inside the container.
 */
export function wrapTextInContainer(
  text: string,
  innerWidthPx: number,
  innerHeightPx: number,
  options: FitTextInContainerOptions = {}
): WrappedCanvasLabel {
  const baseFontSize = options.baseFontSize ?? 11
  const minFontSize = options.minFontSize ?? 7
  const padX = options.padX ?? 4
  const padY = options.padY ?? 2
  const charWidthRatio = options.charWidthRatio ?? 0.58

  const trimmed = text.trim()
  if (!trimmed) {
    return { lines: [], fontSize: baseFontSize, lineHeight: baseFontSize + 2 }
  }

  const availW = Math.max(1, innerWidthPx - padX * 2)
  const availH = Math.max(1, innerHeightPx - padY * 2)
  const words = normalizeLabelWords(trimmed)
  const maxFontSize =
    options.maxFontSize ??
    defaultMaxFontSize(
      trimmed,
      availW,
      availH,
      charWidthRatio,
      baseFontSize,
      minFontSize
    )

  let best: WrappedCanvasLabel = {
    lines: wrapWordsAtSize(words, minFontSize, availW, charWidthRatio),
    fontSize: minFontSize,
    lineHeight: minFontSize + 2,
  }

  for (let fs = minFontSize; fs <= maxFontSize; fs += 0.5) {
    const lines = wrapWordsAtSize(words, fs, availW, charWidthRatio)
    const blockHeight = wrappedBlockHeight(lines.length, fs)
    if (blockHeight <= availH) {
      best = { lines, fontSize: fs, lineHeight: fs + 2 }
    } else {
      break
    }
  }

  if (best.lines.length * best.lineHeight <= availH) {
    return best
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

function singleLineFits(
  trimmed: string,
  fs: number,
  availW: number,
  availH: number,
  charWidthRatio: number
): boolean {
  const charW = fs * charWidthRatio
  const lineH = fs + 2
  return lineH <= availH && trimmed.length * charW <= availW
}

/**
 * Fit `text` inside `innerWidthPx × innerHeightPx` by growing when short
 * and shrinking down to `minFontSize`, then applying ellipsis truncation.
 */
export function fitTextInContainer(
  text: string,
  innerWidthPx: number,
  innerHeightPx: number,
  options: FitTextInContainerOptions = {}
): FittedCanvasLabel {
  const baseFontSize = options.baseFontSize ?? 11
  const minFontSize = options.minFontSize ?? 7
  const padX = options.padX ?? 4
  const padY = options.padY ?? 2
  const charWidthRatio = options.charWidthRatio ?? 0.58

  const trimmed = text.trim()
  if (!trimmed) return { text: '', fontSize: baseFontSize }

  const availW = Math.max(1, innerWidthPx - padX * 2)
  const availH = Math.max(1, innerHeightPx - padY * 2)
  const maxFontSize =
    options.maxFontSize ??
    defaultMaxFontSize(
      trimmed,
      availW,
      availH,
      charWidthRatio,
      baseFontSize,
      minFontSize
    )

  let best: FittedCanvasLabel = { text: trimmed, fontSize: minFontSize }

  for (let fs = minFontSize; fs <= maxFontSize; fs += 0.5) {
    if (singleLineFits(trimmed, fs, availW, availH, charWidthRatio)) {
      best = { text: trimmed, fontSize: fs }
    } else {
      break
    }
  }

  if (singleLineFits(trimmed, best.fontSize, availW, availH, charWidthRatio)) {
    return best
  }

  for (let fs = best.fontSize; fs >= minFontSize; fs -= 0.5) {
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
