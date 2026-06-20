/**
 * Import Location Tent icon from a composite reference sheet (or a single
 * transparent PNG). Removes black backdrop, writes canonical source PNGs.
 *
 * Usage:
 *   node scripts/import-location-tent-logo.mjs [path-to-image.png]
 *   node scripts/import-location-tent-logo.mjs --side=right [path]
 *   node scripts/import-location-tent-logo.mjs --variant=dark [path]
 */
import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const args = process.argv.slice(2)
const sideArg = args.find((a) => a.startsWith('--side='))?.split('=')[1]
const variantArg = args.find((a) => a.startsWith('--variant='))?.split('=')[1] ?? 'light'
const compositePath =
  args.find((a) => !a.startsWith('--')) ??
  path.join(
    process.env.USERPROFILE ?? '',
    '.cursor',
    'projects',
    'c-Users-bradm-Projects-popup-hub',
    'assets',
    'c__Users_bradm_AppData_Roaming_Cursor_User_workspaceStorage_01a3a316bfb67fd14ade27c750985ea5_images_Copilot_20260620_161447-1124dbcb-2468-44aa-b362-e1ae881f6217.png',
  )

function isBackdrop(r, g, b) {
  return r <= 28 && g <= 28 && b <= 28
}

function isLabelPixel(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max >= 150 && max - min <= 40
}

function findRegionBounds(data, width, height, channels, x0, x1) {
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < height; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * channels
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      if (!isBackdrop(r, g, b) && !isLabelPixel(r, g, b)) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  if (maxX <= minX || maxY <= minY) return null

  const pad = 8
  return {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(width - Math.max(0, minX - pad), maxX - minX + 1 + pad * 2),
    height: Math.min(height - Math.max(0, minY - pad), maxY - minY + 1 + pad * 2),
    area: (maxX - minX + 1) * (maxY - minY + 1),
  }
}

function pickBestRegion(data, width, height, channels, sidePreference) {
  const mid = Math.floor(width / 2)
  const regions = {
    left: findRegionBounds(data, width, height, channels, 0, mid),
    right: findRegionBounds(data, width, height, channels, mid, width),
    full: findRegionBounds(data, width, height, channels, 0, width),
  }

  if (sidePreference && regions[sidePreference]) {
    return { name: sidePreference, bounds: regions[sidePreference] }
  }

  const candidates = [regions.left, regions.right].filter(Boolean)
  if (candidates.length === 0) {
    return { name: 'full', bounds: regions.full }
  }

  const best = candidates.reduce((a, b) => (b.area > a.area ? b : a))
  return { name: best === regions.right ? 'right' : 'left', bounds: best }
}

async function removeBlackBackdrop(buffer) {
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
    out[o + 3] = isBackdrop(r, g, b) ? 0 : sourceAlpha
  }

  return sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png()
}

async function main() {
  const meta = await sharp(compositePath).metadata()
  const { data, info } = await sharp(compositePath).raw().toBuffer({ resolveWithObject: true })

  let bounds
  if (meta.width > meta.height * 1.15) {
    const picked = pickBestRegion(data, info.width, info.height, info.channels, sideArg)
    bounds = picked.bounds
    console.log(`Composite detected — using ${picked.name} region`)
  } else {
    bounds = findRegionBounds(data, info.width, info.height, info.channels, 0, info.width)
    console.log('Single icon detected')
  }

  if (!bounds) throw new Error('Could not find logo content in image')

  console.log('Extracting logo region:', bounds)

  const cropped = await sharp(compositePath).extract(bounds).png().toBuffer()
  const transparent = await removeBlackBackdrop(cropped)
  const trimmed = await transparent.trim().png().toBuffer()

  const isDark = variantArg === 'dark'
  const iconSource = path.join(
    root,
    'public',
    isDark ? 'popup-hub-icon-source-dark.png' : 'popup-hub-icon-source.png',
  )
  const logoMaster = path.join(
    root,
    'public',
    isDark ? 'popup-hub-logo-dark.png' : 'popup-hub-logo.png',
  )

  await sharp(trimmed).toFile(iconSource)
  await sharp(trimmed).toFile(logoMaster)

  const outMeta = await sharp(trimmed).metadata()
  console.log(`Wrote ${isDark ? 'dark' : 'light'} icon source:`, iconSource, `${outMeta.width}x${outMeta.height}`)
  console.log(`Wrote ${isDark ? 'dark' : 'light'} logo master:`, logoMaster)
}

await main()
