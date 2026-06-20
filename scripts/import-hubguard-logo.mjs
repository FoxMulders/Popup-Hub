/**
 * Import HubGuard logo from source PNG (1024 lockup on black).
 *
 * Usage: node scripts/import-hubguard-logo.mjs [path-to-image.png]
 */
import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDarkBackdrop, isLightBackdrop } from './logo-artwork-trim.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const publicDir = path.join(root, 'public')

const sourcePath =
  process.argv[2] ??
  path.join(
    process.env.USERPROFILE ?? '',
    '.cursor',
    'projects',
    'c-Users-bradm-Projects-popup-hub',
    'assets',
    'c__Users_bradm_AppData_Roaming_Cursor_User_workspaceStorage_01a3a316bfb67fd14ade27c750985ea5_images_Copilot_20260620_170722-12bee7f8-2d82-4c15-ac66-b8dcd6b555b4.png',
  )

function removeBackdropBuffer(data, info) {
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

async function main() {
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const rgba = removeBackdropBuffer(data, info)
  const png = await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()

  const { data: tData, info: tInfo } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const bounds = contentBounds(tData, tInfo.width, tInfo.height, tInfo.channels)
  if (!bounds) throw new Error('Could not find HubGuard artwork')

  const lockup = await sharp(png)
    .extract({
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    })
    .png()
    .toBuffer()

  const emblemBottom = emblemBottomY(tData, tInfo.width, tInfo.height, tInfo.channels, bounds)
  const icon = await sharp(png)
    .extract({
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: emblemBottom - bounds.top + 1,
    })
    .png()
    .toBuffer()

  const lockupPath = path.join(publicDir, 'hubguard-logo-source.png')
  const iconPath = path.join(publicDir, 'hubguard-icon-source.png')

  await sharp(lockup).toFile(lockupPath)
  await sharp(icon).toFile(iconPath)

  const lockupMeta = await sharp(lockup).metadata()
  const iconMeta = await sharp(icon).metadata()
  console.log('Wrote lockup source:', lockupPath, `${lockupMeta.width}x${lockupMeta.height}`)
  console.log('Wrote emblem source:', iconPath, `${iconMeta.width}x${iconMeta.height}`, `(split y=${emblemBottom})`)
}

await main()
