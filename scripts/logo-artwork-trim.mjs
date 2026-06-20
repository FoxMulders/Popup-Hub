import sharp from 'sharp'

/** Stall green or pin blue — used to ignore filename labels under the icon. */
export function isLogoPixel(r, g, b) {
  return (g > 70 && g > r + 10) || (b > 80 && b > r + 15 && b > g - 25)
}

/** Reference-sheet captions (light or dark gray), not part of the mark. */
export function isLabelPixel(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  if (max >= 150 && chroma <= 40) return true
  if (max <= 120 && chroma <= 35) return true
  return false
}

export function isDarkBackdrop(r, g, b) {
  return r <= 28 && g <= 28 && b <= 28
}

export function isLightBackdrop(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max >= 228 && max - min <= 28
}

export function logoArtworkBounds(data, width, height, channels) {
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      const alpha = channels >= 4 ? data[i + 3] : 255
      if (alpha < 128) continue
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      if (!isLogoPixel(r, g, b) || isLabelPixel(r, g, b)) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX <= minX || maxY <= minY) return null

  const pad = 4
  return {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(width - Math.max(0, minX - pad), maxX - minX + 1 + pad * 2),
    height: Math.min(height - Math.max(0, minY - pad), maxY - minY + 1 + pad * 2),
  }
}

export async function removeSheetBackdrop(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(info.width * info.height * 4)

  for (let px = 0, i = 0; i < data.length; i += info.channels, px++) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const sourceAlpha = info.channels >= 4 ? data[i + 3] : 255
    const o = px * 4
    out[o] = r
    out[o + 1] = g
    out[o + 2] = b
    const isBackdrop = isDarkBackdrop(r, g, b) || isLightBackdrop(r, g, b)
    const isLabel = isLabelPixel(r, g, b)
    out[o + 3] = isBackdrop || isLabel ? 0 : sourceAlpha
  }

  return sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png()
}

/** Crop to stall + pin pixels only — strips size/filename captions. */
export async function trimToLogoArtwork(buffer) {
  const pngBuffer = await removeSheetBackdrop(buffer).then((img) => img.png().toBuffer())
  const { data, info } = await sharp(pngBuffer).raw().toBuffer({ resolveWithObject: true })
  const bounds = logoArtworkBounds(data, info.width, info.height, info.channels)
  if (!bounds) {
    return sharp(pngBuffer).trim().png().toBuffer()
  }
  return sharp(pngBuffer).extract(bounds).png().toBuffer()
}
