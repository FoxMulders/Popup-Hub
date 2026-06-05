import {
  AMAZON_ASSOCIATE_DISCLOSURE,
  AMAZON_ASSOCIATE_TAG,
  buildAmazonCaAffiliateSearchUrl,
} from '@/lib/affiliate/amazon'
import {
  materialChecklistLinkItemSchema,
  rawMaterialChecklistSchema,
  type MaterialChecklistLinkItem,
  type RawMaterialChecklist,
  type RawMaterialChecklistEntry,
} from '@/lib/experience-designer/material-checklist-schema'

export { AMAZON_ASSOCIATE_DISCLOSURE, AMAZON_ASSOCIATE_TAG, buildAmazonCaAffiliateSearchUrl }

const OPTIONAL_PREFIX = /^\s*(optional[:\s-]+)/i
const OPTIONAL_SUFFIX = /\s*\(optional\)\s*$/i

const ACRONYMS = new Set([
  'uv',
  'led',
  'rfid',
  'nfc',
  'usb',
  'hdmi',
  'arduino',
  'esp32',
  'rf',
  'dc',
  'ac',
])

interface CatalogEntry {
  pattern: RegExp
  displayName: string
  searchQuery?: string
  imageUrl?: string
  /** When false, no Amazon link is emitted (props you print yourself, etc.). */
  linkable?: boolean
  displayNote?: string
}

/**
 * Curated escape-room components → display copy, Amazon.ca search terms, and prop art.
 * URLs always use the official associate tag; never embed static prices.
 */
const MATERIAL_CATALOG: CatalogEntry[] = [
  {
    pattern: /cryptic\s+symbol/i,
    displayName: 'Cryptic Symbols',
    imageUrl: '/experience-designer/materials/cryptic-symbols.svg',
    searchQuery: 'escape room cryptic symbol props',
    displayNote: 'Printable symbol set for player handouts',
  },
  {
    pattern: /elemental\s+weights?/i,
    displayName: 'Periodic Table Chart (Elemental Weights)',
    searchQuery: 'periodic table of elements chart poster',
    displayNote: 'Wall chart or poster — not loose weights',
  },
  {
    pattern: /electromagnetic\s+lock|mag[\s-]?lock/i,
    displayName: '12V Electromagnetic Door Lock',
    searchQuery: '12V electromagnetic door lock kit',
  },
  {
    pattern: /combination\s+padlock|4[\s-]?digit\s+padlock/i,
    displayName: '4-Digit Combination Padlock',
    searchQuery: '4 digit combination padlock',
  },
  {
    pattern: /uv\s+flashlight|blacklight\s+flashlight/i,
    displayName: 'UV Flashlight',
    searchQuery: 'UV flashlight blacklight',
  },
  {
    pattern: /arduino\s+uno/i,
    displayName: 'Arduino Uno',
    searchQuery: 'Arduino Uno R3 board',
  },
  {
    pattern: /relay\s+module/i,
    displayName: 'Relay Module',
    searchQuery: '5V relay module Arduino',
  },
  {
    pattern: /magnetic\s+contact|door\s+sensor/i,
    displayName: 'Magnetic Door Contact Sensor',
    searchQuery: 'magnetic door contact sensor wired',
  },
  {
    pattern: /linear\s+actuator/i,
    displayName: 'Linear Actuator',
    searchQuery: '12V linear actuator',
  },
  {
    pattern: /rfid\s+reader/i,
    displayName: 'RFID Reader Module',
    searchQuery: 'RC522 RFID reader module',
  },
]

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function resolveCatalog(raw: string): CatalogEntry | undefined {
  return MATERIAL_CATALOG.find((entry) => entry.pattern.test(raw))
}

function preserveUnitCasing(word: string): string {
  const unitMatch = word.match(/^(\d+)([vVaA]+)$/)
  if (unitMatch) {
    return `${unitMatch[1]}${unitMatch[2].toUpperCase()}`
  }
  return word
}

/** Title-case display names while keeping escape-room acronyms readable. */
export function formatMaterialDisplayName(raw: string): string {
  const catalog = resolveCatalog(raw)
  if (catalog) return catalog.displayName

  const cleaned = raw
    .replace(OPTIONAL_PREFIX, '')
    .replace(OPTIONAL_SUFFIX, '')
    .trim()

  return cleaned
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase()
      if (ACRONYMS.has(lower)) return lower.toUpperCase()
      const withUnit = preserveUnitCasing(word)
      if (withUnit !== word) return withUnit
      if (/^[A-Z0-9]{2,}$/.test(word)) return word
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

function stripOptionalMarkers(raw: string): string {
  return raw.replace(OPTIONAL_PREFIX, '').replace(OPTIONAL_SUFFIX, '').trim()
}

function entryText(entry: RawMaterialChecklistEntry): string {
  if (typeof entry === 'string') return entry
  return (entry.name ?? entry.item ?? '').trim()
}

function entryRequired(
  entry: RawMaterialChecklistEntry,
  defaultRequired: boolean
): boolean {
  if (typeof entry === 'string') {
    if (OPTIONAL_PREFIX.test(entry) || OPTIONAL_SUFFIX.test(entry)) return false
    return defaultRequired
  }
  if (entry.optional === true) return false
  if (entry.required === false) return false
  if (entry.required === true) return true
  return defaultRequired
}

function flattenRawChecklist(input: RawMaterialChecklist): Array<{
  raw: string
  required: boolean
}> {
  if (Array.isArray(input)) {
    return input
      .map((entry) => {
        const text = entryText(entry)
        if (!text) return null
        return {
          raw: stripOptionalMarkers(text),
          required: entryRequired(entry, true),
        }
      })
      .filter((row): row is { raw: string; required: boolean } => Boolean(row))
  }

  const rows: Array<{ raw: string; required: boolean }> = []
  for (const entry of input.required ?? []) {
    const text = entryText(entry)
    if (!text) continue
    rows.push({
      raw: stripOptionalMarkers(text),
      required: entryRequired(entry, true),
    })
  }
  for (const entry of input.optional ?? []) {
    const text = entryText(entry)
    if (!text) continue
    rows.push({
      raw: stripOptionalMarkers(text),
      required: entryRequired(entry, false),
    })
  }
  return rows
}

function enrichRow(raw: string, required: boolean): MaterialChecklistLinkItem {
  const catalog = resolveCatalog(raw)
  const displayName = catalog?.displayName ?? formatMaterialDisplayName(raw)
  const searchQuery = catalog?.searchQuery ?? displayName
  const linkable = catalog?.linkable !== false

  const item: MaterialChecklistLinkItem = {
    name: displayName,
    required,
    affiliate_url: linkable ? buildAmazonCaAffiliateSearchUrl(searchQuery) : null,
    ...(catalog?.imageUrl ? { image_url: catalog.imageUrl } : {}),
    ...(catalog?.displayNote ? { display_note: catalog.displayNote } : {}),
  }

  return materialChecklistLinkItemSchema.parse(item)
}

function dedupeKey(item: MaterialChecklistLinkItem): string {
  return normalizeKey(item.name)
}

/**
 * Parse and normalize AI `material_checklist` data into sorted hyperlink rows.
 * Required items appear before optional; stable alphabetical order within each group.
 */
export function processMaterialChecklist(
  input: unknown
): MaterialChecklistLinkItem[] {
  const parsed = rawMaterialChecklistSchema.safeParse(input)
  if (!parsed.success) return []

  const flattened = flattenRawChecklist(parsed.data)
  const seen = new Set<string>()
  const required: MaterialChecklistLinkItem[] = []
  const optional: MaterialChecklistLinkItem[] = []

  for (const row of flattened) {
    if (!row.raw) continue
    const item = enrichRow(row.raw, row.required)
    const key = dedupeKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    if (item.required) required.push(item)
    else optional.push(item)
  }

  const byName = (a: MaterialChecklistLinkItem, b: MaterialChecklistLinkItem) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })

  required.sort(byName)
  optional.sort(byName)

  return [...required, ...optional]
}

/** Merge legacy string lists (BOM + props) into a single checklist input. */
export function processLegacyMaterialLists(opts: {
  billOfMaterials?: string[]
  requiredPartsAndProps?: string[]
  materialChecklist?: unknown
}): MaterialChecklistLinkItem[] {
  if (opts.materialChecklist != null) {
    const fromChecklist = processMaterialChecklist(opts.materialChecklist)
    if (fromChecklist.length) return fromChecklist
  }

  const required = [
    ...(opts.billOfMaterials ?? []),
    ...(opts.requiredPartsAndProps ?? []),
  ]

  if (!required.length) return []

  return processMaterialChecklist(required)
}
