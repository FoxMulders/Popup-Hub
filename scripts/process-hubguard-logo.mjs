/**
 * HubGuard brand artwork — shield + stall + pin, optional wordmark lockup.
 */
import sharp from 'sharp'
import { access, mkdir, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDarkBackdrop, isLightBackdrop } from './logo-artwork-trim.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const publicDir = path.join(root, 'public')

const LOCKUP_SOURCE = path.join(publicDir, 'hubguard-logo-source.png')
const ICON_SOURCE = path.join(publicDir, 'hubguard-icon-source.png')
const LOCKUP_OUT = path.join(publicDir, 'hubguard-logo.png')
const ICON_OUT = path.join(publicDir, 'hubguard-icon.png')

const LOCKUP_MAX_WIDTH = 640
const ICON_SIZE = 512

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

function removeBackdrop(data, info) {
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
    const backdrop = isDarkBackdrop(r, g, b) || isLightBackdrop(r, g, b)
    out[o + 3] = backdrop ? 0 : sourceAlpha
  }
  return out
}

function rowFill(data, width, channels, y) {
  let count = 0
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels
    if (data[i + 3] >= 128) count++
  }
  return count
}

function contentBounds(data, width, height, channels) {
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      if (data[i + 3] < 128) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX <= minX || maxY <= minY) return null

  const pad = 6
  return {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(width - Math.max(0, minX - pad), maxX - minX + 1 + pad * 2),
    height: Math.min(height - Math.max(0, minY - pad), maxY - minY + 1 + pad * 2),
    minY: Math.max(0, minY - pad),
    maxY: Math.min(height - 1, maxY + pad),
  }
}

function emblemBottomY(data, width, height, channels, bounds) {
  const rowCount = new Array(height).fill(0)
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    rowCount[y] = rowFill(data, width, channels, y)
  }

  let best = { start: bounds.minY, len: 0 }
  let curStart = -1
  let curLen = 0
  const searchFrom = bounds.minY + Math.floor((bounds.maxY - bounds.minY) * 0.45)

  for (let y = searchFrom; y <= bounds.maxY; y++) {
    if (rowCount[y] < 30) {
      if (curStart < 0) curStart = y
      curLen++
    } else if (curLen > best.len) {
      best = { start: curStart, len: curLen }
      curStart = -1
      curLen = 0
    } else {
      curStart = -1
      curLen = 0
    }
  }
  if (curLen > best.len) best = { start: curStart, len: curLen }

  if (best.len >= 20) return best.start - 1
  return bounds.minY + Math.floor((bounds.maxY - bounds.minY) * 0.72)
}

async function loadTransparentSource(sourcePath) {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const rgba = removeBackdrop(data, info)
  const png = await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()

  const trimmed = await sharp(png).trim().png().toBuffer()
  const { data: tData, info: tInfo } = await sharp(trimmed)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const bounds = contentBounds(tData, tInfo.width, tInfo.height, tInfo.channels)
  if (!bounds) throw new Error(`No artwork found in ${sourcePath}`)

  return { buffer: trimmed, data: tData, info: tInfo, bounds }
}

async function squareIcon(buffer, size) {
  const meta = await sharp(buffer).metadata()
  const maxDim = Math.max(meta.width, meta.height)
  const padTop = Math.floor((maxDim - meta.height) / 2)
  const padBottom = maxDim - meta.height - padTop
  const padLeft = Math.floor((maxDim - meta.width) / 2)
  const padRight = maxDim - meta.width - padLeft

  const square = await sharp(buffer)
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer()

  return square
}

async function main() {
  await mkdir(publicDir, { recursive: true })

  try {
    await access(LOCKUP_SOURCE)
  } catch {
    console.error('Missing hubguard-logo-source.png — run scripts/import-hubguard-logo.mjs first')
    process.exit(1)
  }

  const lockup = await loadTransparentSource(LOCKUP_SOURCE)
  const lockupCrop = await sharp(lockup.buffer)
    .extract({
      left: lockup.bounds.left,
      top: lockup.bounds.top,
      width: lockup.bounds.width,
      height: lockup.bounds.height,
    })
    .png()
    .toBuffer()

  const lockupSized = await sharp(lockupCrop)
    .resize(LOCKUP_MAX_WIDTH, null, {
      fit: 'inside',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer()

  await writePngAtomically(LOCKUP_OUT, lockupSized)
  const lockupMeta = await sharp(lockupSized).metadata()
  console.log('Wrote lockup:', LOCKUP_OUT, `${lockupMeta.width}x${lockupMeta.height}`)

  let iconBuffer
  try {
    await access(ICON_SOURCE)
    const icon = await loadTransparentSource(ICON_SOURCE)
    iconBuffer = await sharp(icon.buffer)
      .extract({
        left: icon.bounds.left,
        top: icon.bounds.top,
        width: icon.bounds.width,
        height: icon.bounds.height,
      })
      .png()
      .toBuffer()
    console.log('Using emblem source:', ICON_SOURCE)
  } catch {
    const emblemBottom = emblemBottomY(
      lockup.data,
      lockup.info.width,
      lockup.info.height,
      lockup.info.channels,
      lockup.bounds,
    )
    iconBuffer = await sharp(lockup.buffer)
      .extract({
        left: lockup.bounds.left,
        top: lockup.bounds.top,
        width: lockup.bounds.width,
        height: emblemBottom - lockup.bounds.top + 1,
      })
      .png()
      .toBuffer()
    await sharp(iconBuffer).toFile(ICON_SOURCE)
    console.log('Wrote emblem source from lockup split at y=', emblemBottom)
  }

  const iconSquare = await squareIcon(iconBuffer, ICON_SIZE)
  await writePngAtomically(ICON_OUT, iconSquare)
  console.log('Wrote icon:', ICON_OUT, `${ICON_SIZE}x${ICON_SIZE}`)
}

await main()
