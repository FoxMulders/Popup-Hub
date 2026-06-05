import sharp from 'sharp'
import { mkdir, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const input = path.join(root, 'public', 'popup-hub-logo.png')
const outputLogo = path.join(root, 'public', 'popup-hub-logo.png')
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

async function getVisualCentroid(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let sumX = 0
  let sumY = 0
  let weight = 0

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4
      const a = data[i + 3] / 255
      if (a > 0.05) {
        sumX += x * a
        sumY += y * a
        weight += a
      }
    }
  }

  return {
    x: weight > 0 ? sumX / weight : info.width / 2,
    y: weight > 0 ? sumY / weight : info.height / 2,
    width: info.width,
    height: info.height,
  }
}

async function opticallyCenterBuffer(buffer) {
  const meta = await sharp(buffer).metadata()
  const { x: cx, y: cy } = await getVisualCentroid(buffer)
  const left = Math.round(meta.width / 2 - cx)
  const top = Math.round(meta.height / 2 - cy)

  return sharp({
    create: {
      width: meta.width,
      height: meta.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: buffer, left, top }])
    .png()
    .toBuffer()
}

async function makeTransparentLogo() {
  const source = await sharp(input).ensureAlpha().png().toBuffer()
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

  const transparent = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()

  await writePngAtomically(outputLogo, transparent)
  await writePngAtomically(path.join(root, 'public', 'popup-hub-brand.png'), transparent)
  // Legacy Lottie JSON references `logo.png` at the site root.
  await writePngAtomically(path.join(root, 'public', 'logo.png'), transparent)

  const meta = await sharp(transparent).metadata()
  console.log('Wrote transparent logo:', outputLogo, `${meta.width}x${meta.height}`, `alpha=${meta.hasAlpha}`)
}

async function trimToSquare(buffer) {
  const trimmed = await sharp(buffer).trim().png().toBuffer()
  const meta = await sharp(trimmed).metadata()
  const maxDim = Math.max(meta.width, meta.height)
  const padTop = Math.floor((maxDim - meta.height) / 2)
  const padBottom = maxDim - meta.height - padTop
  const padLeft = Math.floor((maxDim - meta.width) / 2)
  const padRight = maxDim - meta.width - padLeft

  const squared = await sharp(trimmed)
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  return opticallyCenterBuffer(squared)
}

/** Full vertical lockup (icon + wordmark) for app icons. */
async function extractFullLockup() {
  const trimmed = await sharp(outputLogo).trim().png().toBuffer()
  return trimToSquare(trimmed)
}

/** Stall + pin mark for compact favicons. */
async function extractIconMark() {
  const trimmed = await sharp(outputLogo).trim().png().toBuffer()
  const meta = await sharp(trimmed).metadata()
  const iconHeight = Math.round(meta.height * 0.56)

  const iconOnly = await sharp(trimmed)
    .extract({ left: 0, top: 0, width: meta.width, height: iconHeight })
    .trim()
    .png()
    .toBuffer()

  const square = await trimToSquare(iconOnly)
  const out = path.join(root, 'public', 'popup-hub-icon.png')
  await sharp(square).toFile(out)
  console.log('Wrote icon mark:', out)

  return square
}

async function iconOnBackground(iconBuffer, size, background, scale = 0.72) {
  const square = await trimToSquare(iconBuffer)
  const iconSize = Math.round(size * scale)
  const resized = await sharp(square)
    .resize(iconSize, iconSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const { x: cx, y: cy } = await getVisualCentroid(resized)
  const left = Math.round(size / 2 - cx)
  const top = Math.round(size / 2 - cy)

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

async function writeIcons(fullLockup, iconMark) {
  await mkdir(iconsDir, { recursive: true })
  await mkdir(appDir, { recursive: true })

  for (const size of [192, 512]) {
    const square = await trimToSquare(fullLockup)
    const transparent = await sharp(square)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()

    const out = path.join(iconsDir, `icon-${size}x${size}.png`)
    await sharp(transparent).toFile(out)
    console.log('Wrote icon:', out)
  }

  const maskable512 = await iconOnBackground(fullLockup, 512, CREAM, 0.78)
  await sharp(maskable512).toFile(path.join(iconsDir, 'icon-maskable-512x512.png'))
  console.log('Wrote maskable icon:', path.join(iconsDir, 'icon-maskable-512x512.png'))

  const appleTouch = await iconOnBackground(fullLockup, 180, CREAM, 0.8)
  await sharp(appleTouch).toFile(path.join(iconsDir, 'apple-touch-icon.png'))
  console.log('Wrote apple-touch-icon:', path.join(iconsDir, 'apple-touch-icon.png'))

  for (const size of [16, 32]) {
    const favicon = await iconOnBackground(iconMark, size, CREAM, 0.78)
    await sharp(favicon).toFile(path.join(root, 'public', `favicon-${size}x${size}.png`))
    console.log('Wrote favicon:', path.join(root, 'public', `favicon-${size}x${size}.png`))
  }

  const favicon32 = await iconOnBackground(iconMark, 32, CREAM, 0.78)
  await sharp(favicon32).toFile(path.join(root, 'public', 'favicon.ico'))
  console.log('Wrote favicon.ico')

  const nextIcon = await iconOnBackground(fullLockup, 512, CREAM, 0.78)
  await sharp(nextIcon).toFile(path.join(appDir, 'icon.png'))
  console.log('Wrote Next.js app icon:', path.join(appDir, 'icon.png'))

  await sharp(appleTouch).toFile(path.join(appDir, 'apple-icon.png'))
  console.log('Wrote Next.js apple icon:', path.join(appDir, 'apple-icon.png'))
}

await makeTransparentLogo()
const fullLockup = await extractFullLockup()
const iconMark = await extractIconMark()
await writeIcons(fullLockup, iconMark)
