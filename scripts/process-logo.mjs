import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const input = path.join(root, 'public', 'popup-hub-logo.png')
const outputLogo = path.join(root, 'public', 'popup-hub-logo.png')
const iconsDir = path.join(root, 'public', 'icons')
const appDir = path.join(root, 'app')

/** Cream app background — matches manifest background_color */
const CREAM = { r: 250, g: 248, b: 245, alpha: 1 }

function backgroundAlpha(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  const lum = (r + g + b) / 3

  if (chroma < 20) {
    if (lum >= 232) return 0
    if (lum >= 205) return Math.round(((232 - lum) / 27) * 255)
  }

  return 255
}

async function makeTransparentLogo() {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const out = Buffer.alloc(info.width * info.height * 4)

  for (let i = 0, px = 0; i < data.length; i += info.channels, px++) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const alpha = backgroundAlpha(r, g, b)
    const o = px * 4
    out[o] = r
    out[o + 1] = g
    out[o + 2] = b
    out[o + 3] = alpha
  }

  await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(outputLogo)

  await sharp(outputLogo).toFile(path.join(root, 'public', 'popup-hub-brand.png'))

  const meta = await sharp(outputLogo).metadata()
  console.log('Wrote transparent logo:', outputLogo, `${meta.width}x${meta.height}`, `alpha=${meta.hasAlpha}`)
}

async function extractIconMark() {
  const meta = await sharp(outputLogo).metadata()
  const iconCropWidth = Math.round(meta.width * 0.42)
  const iconCropHeight = Math.round(meta.height * 0.72)
  const left = Math.round((meta.width - iconCropWidth) * 0.08)
  const top = Math.round((meta.height - iconCropHeight) * 0.05)

  const iconOnly = await sharp(outputLogo)
    .extract({ left, top, width: iconCropWidth, height: iconCropHeight })
    .png()
    .toBuffer()

  await sharp(iconOnly).toFile(path.join(root, 'public', 'popup-hub-icon.png'))
  console.log('Wrote icon mark:', path.join(root, 'public', 'popup-hub-icon.png'))

  return iconOnly
}

async function iconOnBackground(iconBuffer, size, background, scale = 0.72) {
  const iconSize = Math.round(size * scale)
  const resized = await sharp(iconBuffer)
    .resize(iconSize, iconSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toBuffer()
}

async function writeIcons(iconOnly) {
  await mkdir(iconsDir, { recursive: true })
  await mkdir(appDir, { recursive: true })

  for (const size of [192, 512]) {
    const transparent = await sharp(iconOnly)
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

  const maskable512 = await iconOnBackground(iconOnly, 512, CREAM, 0.68)
  await sharp(maskable512).toFile(path.join(iconsDir, 'icon-maskable-512x512.png'))
  console.log('Wrote maskable icon:', path.join(iconsDir, 'icon-maskable-512x512.png'))

  const appleTouch = await iconOnBackground(iconOnly, 180, CREAM, 0.7)
  await sharp(appleTouch).toFile(path.join(iconsDir, 'apple-touch-icon.png'))
  console.log('Wrote apple-touch-icon:', path.join(iconsDir, 'apple-touch-icon.png'))

  for (const size of [16, 32]) {
    const favicon = await iconOnBackground(iconOnly, size, CREAM, 0.78)
    await sharp(favicon).toFile(path.join(root, 'public', `favicon-${size}x${size}.png`))
    console.log('Wrote favicon:', path.join(root, 'public', `favicon-${size}x${size}.png`))
  }

  const favicon32 = await iconOnBackground(iconOnly, 32, CREAM, 0.78)
  await sharp(favicon32).toFile(path.join(root, 'public', 'favicon.ico'))
  console.log('Wrote favicon.ico')

  const nextIcon = await iconOnBackground(iconOnly, 512, CREAM, 0.68)
  await sharp(nextIcon).toFile(path.join(appDir, 'icon.png'))
  console.log('Wrote Next.js app icon:', path.join(appDir, 'icon.png'))

  await sharp(appleTouch).toFile(path.join(appDir, 'apple-icon.png'))
  console.log('Wrote Next.js apple icon:', path.join(appDir, 'apple-icon.png'))
}

await makeTransparentLogo()
const iconOnly = await extractIconMark()
await writeIcons(iconOnly)
