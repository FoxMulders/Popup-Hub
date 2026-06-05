/**
 * Writes public/sitemap.xml from the same entry collector used by app/sitemap.ts.
 * Run: npx tsx scripts/generate-sitemap.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectSitemapEntries } from '../lib/seo/collect-sitemap-entries'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function main() {
  const entries = await collectSitemapEntries()
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ]

  for (const item of entries) {
    lines.push('  <url>')
    lines.push(`    <loc>${escapeXml(item.url)}</loc>`)
    if (item.lastModified) {
      const iso =
        item.lastModified instanceof Date
          ? item.lastModified.toISOString()
          : new Date(item.lastModified).toISOString()
      lines.push(`    <lastmod>${iso}</lastmod>`)
    }
    if (item.changeFrequency) {
      lines.push(`    <changefreq>${item.changeFrequency}</changefreq>`)
    }
    if (item.priority != null) {
      lines.push(`    <priority>${item.priority.toFixed(1)}</priority>`)
    }
    lines.push('  </url>')
  }

  lines.push('</urlset>')

  const outPath = join(root, 'public', 'sitemap.xml')
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8')
  console.log(`Wrote ${entries.length} URLs to public/sitemap.xml`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
