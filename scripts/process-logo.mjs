import sharp from 'sharp'
import { access, mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { trimToLogoArtwork } from './logo-artwork-trim.mjs'

async function writePngAtomically(targetPath, buffer) {
  const tempPath = `${targetPath}.tmp`
  await sharp(buffer).png().toFile(tempPath)
  try {
    await unlink(targetPath)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
      throw error
    }
  }
  await rename(tempPath, targetPath)
}

async function writeBufferAtomically(targetPath, buffer) {
  const tempPath = `${targetPath}.tmp`
  await writeFile(tempPath, buffer)
  try {
    await unlink(targetPath)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
      throw error
    }
  }
  await rename(tempPath, targetPath)
}

/** Pack PNG image buffers into a single .ico (PNG-compressed entries, Vista+). */
function pngBuffersToIco(entries) {
  const count = entries.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  let offset = 6 + count * 16
  const parts = [header]

  for (const { png, width, height } of entries) {
    const entry = Buffer.alloc(16)
    entry[0] = width >= 256 ? 0 : width
    entry[1] = height >= 256 ? 0 : height
    entry[4] = 1
    entry[6] = 32
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    parts.push(entry)
    offset += png.length
  }

  for (const { png } of entries) {
    parts.push(png)
  }

  return Buffer.concat(parts)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const input = path.join(root, 'public', 'popup-hub-logo.png')
const outputLogo = path.join(root, 'public', 'popup-hub-logo.png')
/** Canonical vector mark — rasterized to high-res PNG before icon extraction. */
const markSvg = path.join(root, 'public', 'popup-hub-mark.svg')
/** Canonical stall+pin artwork — preferred over lockup crop when present. */
const iconSource = path.join(root, 'public', 'popup-hub-icon-source.png')
const iconSourceDark = path.join(root, 'public', 'popup-hub-icon-source-dark.png')
const iconsDir = path.join(root, 'public', 'icons')
const appDir = path.join(root, 'app')

/** Cream app background — matches manifest background_color */
const CREAM = { r: 250, g: 248, b: 245, alpha: 1 }

/** Neutral export backdrop (cream / off-white / light gray checkerboard). */
function isBackgroundColor(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  const lum = (r + g + b) / 3
  return chroma <= 28 && lum >= 180
}

function floodFillBackgroundMask(data, width, height, channels) {
  const mask = new Uint8Array(width * height)
  const queue = []

  const trySeed = (x, y) => {
    const px = y * width + x
    if (mask[px]) return
    const i = px * channels
    if (isBackgroundColor(data[i], data[i + 1], data[i + 2])) {
      mask[px] = 1
      queue.push(px)
    }
  }

  for (let x = 0; x < width; x++) {
    trySeed(x, 0)
    trySeed(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    trySeed(0, y)
    trySeed(width - 1, y)
  }

  while (queue.length > 0) {
    const px = queue.pop()
    const x = px % width
    const y = (px / width) | 0

    if (x > 0) {
      const left = px - 1
      if (!mask[left]) {
        const i = left * channels
        if (isBackgroundColor(data[i], data[i + 1], data[i + 2])) {
          mask[left] = 1
          queue.push(left)
        }
      }
    }
    if (x < width - 1) {
      const right = px + 1
      if (!mask[right]) {
        const i = right * channels
        if (isBackgroundColor(data[i], data[i + 1], data[i + 2])) {
          mask[right] = 1
          queue.push(right)
        }
      }
    }
    if (y > 0) {
      const up = px - width
      if (!mask[up]) {
        const i = up * channels
        if (isBackgroundColor(data[i], data[i + 1], data[i + 2])) {
          mask[up] = 1
          queue.push(up)
        }
      }
    }
    if (y < height - 1) {
      const down = px + width
      if (!mask[down]) {
        const i = down * channels
        if (isBackgroundColor(data[i], data[i + 1], data[i + 2])) {
          mask[down] = 1
          queue.push(down)
        }
      }
    }
  }

  return mask
}

async function makeTransparentBuffer(filePath) {
  const source = await sharp(filePath).ensureAlpha().png().toBuffer()
  const { data, info } = await sharp(source)
    .raw()
    .toBuffer({ resolveWithObject: true })

  const backgroundMask = floodFillBackgroundMask(data, info.width, info.height, info.channels)
  const out = Buffer.alloc(info.width * info.height * 4)

  for (let i = 0, px = 0; i < data.length; i += info.channels, px++) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const sourceAlpha = info.channels >= 4 ? data[i + 3] : 255
    const o = px * 4
    out[o] = r
    out[o + 1] = g
    out[o + 2] = b
    const isBackdrop =
      backgroundMask[px] || (sourceAlpha > 0 && isBackgroundColor(r, g, b))
    out[o + 3] = isBackdrop ? 0 : sourceAlpha
  }

  return sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()
}

async function makeTransparentLogo() {
  const transparent = await makeTransparentBuffer(input)
  await writePngAtomically(outputLogo, transparent)

  const meta = await sharp(transparent).metadata()
  console.log('Wrote transparent source logo:', outputLogo, `${meta.width}x${meta.height}`, `alpha=${meta.hasAlpha}`)
}

async function trimToSquare(buffer) {
  const trimmed = await sharp(buffer).trim().png().toBuffer()
  const meta = await sharp(trimmed).metadata()
  const maxDim = Math.max(meta.width, meta.height)
  const padTop = Math.floor((maxDim - meta.height) / 2)
  const padBottom = maxDim - meta.height - padTop
  const padLeft = Math.floor((maxDim - meta.width) / 2)
  const padRight = maxDim - meta.width - padLeft

  return sharp(trimmed)
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
}

/** Full vertical lockup (icon + wordmark) — archived in popup-hub-logo.png source only. */
async function extractFullLockup() {
  const trimmed = await sharp(outputLogo).trim().png().toBuffer()
  return trimToSquare(trimmed)
}

async function iconMarkFromLockupCrop() {
  const trimmed = await sharp(outputLogo).trim().png().toBuffer()
  const meta = await sharp(trimmed).metadata()
  const iconHeight = Math.round(meta.height * 0.56)

  return sharp(trimmed)
    .extract({ left: 0, top: 0, width: meta.width, height: iconHeight })
    .trim()
    .png()
    .toBuffer()
}

/** Stall + pin mark for UI, animations, and compact favicons. */
async function iconMarkFromSource(sourcePath, label) {
  let iconOnly
  try {
    await access(sourcePath)
    iconOnly = await makeTransparentBuffer(sourcePath)
    iconOnly = await trimToLogoArtwork(iconOnly)
    console.log(`Using canonical icon source (${label}):`, sourcePath)
  } catch {
    return null
  }

  return trimToSquare(iconOnly)
}

async function writeBrandMark(square, { iconOut, brandOut, label }) {
  await sharp(square).toFile(iconOut)
  console.log(`Wrote icon mark (${label}):`, iconOut)

  const meta = await sharp(square).metadata()
  const maxDim = Math.max(meta.width, meta.height)
  let brandSquare
  if (maxDim <= 994) {
    brandSquare = await sharp(square).png().toBuffer()
  } else {
    brandSquare = await sharp(square)
      .resize(994, 994, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toBuffer()
  }
  await writePngAtomically(brandOut, brandSquare)
  console.log(`Wrote UI brand icon (${label}):`, brandOut)

  return brandSquare
}

/** Render vector mark to crisp raster master for favicons and loader assets. */
async function renderSvgToIconSources() {
  try {
    await access(markSvg)
  } catch {
    console.log('No popup-hub-mark.svg — using existing icon sources')
    return
  }

  const masterSize = 2048
  const master = await sharp(markSvg, { density: 300 })
    .resize(masterSize, masterSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  await writePngAtomically(iconSource, master)
  await writePngAtomically(iconSourceDark, master)
  const meta = await sharp(master).metadata()
  console.log('Rasterized vector mark:', markSvg, `${meta.width}x${meta.height}`)
}

async function extractIconMark() {
  let iconOnly
  try {
    await access(iconSource)
    iconOnly = await makeTransparentBuffer(iconSource)
    iconOnly = await trimToLogoArtwork(iconOnly)
    console.log('Using canonical icon source:', iconSource)
  } catch {
    iconOnly = await iconMarkFromLockupCrop()
    console.log('Using lockup crop (no popup-hub-icon-source.png)')
  }

  const square = await trimToSquare(iconOnly)
  const brandSquare = await writeBrandMark(square, {
    iconOut: path.join(root, 'public', 'popup-hub-icon.png'),
    brandOut: path.join(root, 'public', 'popup-hub-brand.png'),
    label: 'light',
  })

  // Icon-only legacy paths — Lottie demo and runtime swap target icon mark.
  await writePngAtomically(path.join(root, 'public', 'logo.png'), brandSquare)
  await writePngAtomically(path.join(root, 'public', 'placeholder-logo.png'), brandSquare)

  return square
}

async function extractDarkIconMark() {
  const square = await iconMarkFromSource(iconSourceDark, 'dark')
  if (!square) {
    console.log('No dark icon source — skipping popup-hub-brand-dark.png')
    return null
  }

  await writeBrandMark(square, {
    iconOut: path.join(root, 'public', 'popup-hub-icon-dark.png'),
    brandOut: path.join(root, 'public', 'popup-hub-brand-dark.png'),
    label: 'dark',
  })

  return square
}

/**
 * Place the full logo lockup on a square canvas with equal safe margins.
 * Uses geometric centering so tall lockups (icon + wordmark) are never clipped.
 * paddingRatio is the inset on each edge (e.g. 0.12 → 12% margin all around).
 */
async function iconOnBackground(iconBuffer, size, background, paddingRatio = 0.12) {
  const trimmed = await sharp(iconBuffer).trim().png().toBuffer()
  const meta = await sharp(trimmed).metadata()
  const inner = size * (1 - 2 * paddingRatio)
  const scale = inner / Math.max(meta.width, meta.height)
  const targetW = Math.round(meta.width * scale)
  const targetH = Math.round(meta.height * scale)

  const resized = await sharp(trimmed)
    .resize(targetW, targetH, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer()

  const left = Math.round((size - targetW) / 2)
  const top = Math.round((size - targetH) / 2)

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer()
}

/** Transparent PWA exports — padded lockup so nothing touches the square edge. */
async function transparentIcon(iconBuffer, size, paddingRatio = 0.1) {
  const trimmed = await sharp(iconBuffer).trim().png().toBuffer()
  const meta = await sharp(trimmed).metadata()
  const inner = size * (1 - 2 * paddingRatio)
  const scale = inner / Math.max(meta.width, meta.height)
  const targetW = Math.round(meta.width * scale)
  const targetH = Math.round(meta.height * scale)

  const resized = await sharp(trimmed)
    .resize(targetW, targetH, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer()

  const left = Math.round((size - targetW) / 2)
  const top = Math.round((size - targetH) / 2)

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer()
}

/** Frosted glass tile: soft cream gradient, subtle border, transparent corners. */
async function glassIcon(iconBuffer, size, paddingRatio = 0.12) {
  const innerPad = Math.round(size * paddingRatio)
  const tileSize = size - innerPad * 2
  const frosted = await sharp({
    create: {
      width: tileSize,
      height: tileSize,
      channels: 4,
      background: { r: 250, g: 248, b: 245, alpha: 220 },
    },
  })
    .png()
    .toBuffer()

  const gradientSvg = Buffer.from(`
    <svg width="${tileSize}" height="${tileSize}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.55)"/>
          <stop offset="100%" stop-color="rgba(45,90,39,0.08)"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" rx="${Math.round(tileSize * 0.22)}" fill="url(#g)"/>
      <rect x="1" y="1" width="${tileSize - 2}" height="${tileSize - 2}" rx="${Math.round(tileSize * 0.22)}"
        fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="2"/>
    </svg>`)

  const mark = await transparentIcon(iconBuffer, tileSize, 0.14)

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: frosted, left: innerPad, top: innerPad },
      { input: gradientSvg, left: innerPad, top: innerPad },
      { input: mark, left: innerPad, top: innerPad },
    ])
    .png()
    .toBuffer()
}

async function writeIcons(iconMark) {
  await mkdir(iconsDir, { recursive: true })
  await mkdir(appDir, { recursive: true })

  for (const size of [192, 512]) {
    const transparent = await transparentIcon(iconMark, size, 0.1)
    const out = path.join(iconsDir, `icon-${size}x${size}.png`)
    await sharp(transparent).toFile(out)
    console.log('Wrote icon:', out)
  }

  const maskable512 = await glassIcon(iconMark, 512, 0.1)
  await sharp(maskable512).toFile(path.join(iconsDir, 'icon-maskable-512x512.png'))
  console.log('Wrote maskable icon:', path.join(iconsDir, 'icon-maskable-512x512.png'))

  const appleTouch = await glassIcon(iconMark, 180, 0.1)
  await sharp(appleTouch).toFile(path.join(iconsDir, 'apple-touch-icon.png'))
  console.log('Wrote apple-touch-icon:', path.join(iconsDir, 'apple-touch-icon.png'))

  // Browser tab favicons: icon mark (stall+pin), not full lockup — wordmark is illegible at 16–32px.
  // Transparent background; minimal padding (~3%) maximizes mark size at 16–32px.
  const FAVICON_PADDING = 0.03
  const faviconSource = iconMark
  const faviconIcoEntries = []

  for (const size of [16, 32]) {
    const favicon = await transparentIcon(faviconSource, size, FAVICON_PADDING)
    const out = path.join(root, 'public', `favicon-${size}x${size}.png`)
    await sharp(favicon).toFile(out)
    console.log('Wrote favicon:', out)
    const meta = await sharp(favicon).metadata()
    faviconIcoEntries.push({ png: favicon, width: meta.width, height: meta.height })
  }

  const faviconIco = pngBuffersToIco(faviconIcoEntries)
  for (const faviconPath of [
    path.join(root, 'public', 'favicon.ico'),
    path.join(appDir, 'favicon.ico'),
  ]) {
    await writeBufferAtomically(faviconPath, faviconIco)
    console.log('Wrote favicon.ico:', faviconPath)
  }

  const nextIcon = await glassIcon(iconMark, 512, 0.1)
  await sharp(nextIcon).toFile(path.join(appDir, 'icon.png'))
  console.log('Wrote Next.js app icon:', path.join(appDir, 'icon.png'))

  await sharp(appleTouch).toFile(path.join(appDir, 'apple-icon.png'))
  console.log('Wrote Next.js apple icon:', path.join(appDir, 'apple-icon.png'))

  const badge96 = await iconOnBackground(iconMark, 96, CREAM, 0.08)
  await sharp(badge96).toFile(path.join(iconsDir, 'badge-96x96.png'))
  console.log('Wrote badge icon:', path.join(iconsDir, 'badge-96x96.png'))
}

await renderSvgToIconSources()
await makeTransparentLogo()
const iconMark = await extractIconMark()
await extractDarkIconMark()
await writeIcons(iconMark)
