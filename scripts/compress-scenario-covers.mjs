// One-off: compress generated scenario cover PNGs into web-friendly JPGs.
import { readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const dir = join(process.cwd(), 'public', 'scenario-markets')
const pngs = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png'))

if (pngs.length === 0) {
  console.log('No PNGs to compress in', dir)
  process.exit(0)
}

for (const png of pngs) {
  const src = join(dir, png)
  const out = join(dir, png.replace(/\.png$/i, '.jpg'))
  await sharp(src)
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(out)
  const before = Math.round(statSync(src).size / 1024)
  const after = Math.round(statSync(out).size / 1024)
  unlinkSync(src)
  console.log(`${png} ${before}KB -> ${after}KB`)
}

console.log(`Done — compressed ${pngs.length} cover(s).`)
