import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..', '..')

const source = process.argv[2]
const out = path.join(root, 'public', 'popup-hub-wordmark.png')

if (!source) {
  console.error('Usage: node build-wordmark.mjs <source.png>')
  process.exit(1)
}

const img = sharp(source).ensureAlpha()
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
const { width, height, channels } = info

// Key the solid black background out to transparency.
// alpha = max(r,g,b) boosted so bright text is fully opaque while pure
// black falls to 0 — preserves both the green "Popup" and blue "Hub".
let minX = width, minY = height, maxX = 0, maxY = 0
for (let i = 0; i < width * height; i++) {
  const o = i * channels
  const r = data[o]
  const g = data[o + 1]
  const b = data[o + 2]
  const maxc = Math.max(r, g, b)
  const alpha = Math.min(255, Math.round(maxc * 1.6))
  data[o + 3] = alpha
  if (alpha > 16) {
    const x = i % width
    const y = (i / width) | 0
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
}

const pad = 12
minX = Math.max(0, minX - pad)
minY = Math.max(0, minY - pad)
maxX = Math.min(width - 1, maxX + pad)
maxY = Math.min(height - 1, maxY + pad)

await sharp(data, { raw: { width, height, channels } })
  .extract({
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  })
  .png()
  .toFile(out)

console.log(`Wrote ${out} (${maxX - minX + 1}x${maxY - minY + 1})`)
