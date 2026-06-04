import { z } from 'zod'

/** Single row from AI `material_checklist` (string or structured). */
export const rawMaterialChecklistEntrySchema = z.union([
  z.string().min(1),
  z
    .object({
      name: z.string().min(1).optional(),
      item: z.string().min(1).optional(),
      required: z.boolean().optional(),
      optional: z.boolean().optional(),
    })
    .refine((row) => Boolean(row.name?.trim() || row.item?.trim()), {
      message: 'Material entry needs name or item',
    }),
])

export type RawMaterialChecklistEntry = z.infer<typeof rawMaterialChecklistEntrySchema>

/** AI may return a flat list or required/optional buckets. */
export const rawMaterialChecklistSchema = z.union([
  z.array(rawMaterialChecklistEntrySchema),
  z.object({
    required: z.array(rawMaterialChecklistEntrySchema).optional(),
    optional: z.array(rawMaterialChecklistEntrySchema).optional(),
  }),
])

export type RawMaterialChecklist = z.infer<typeof rawMaterialChecklistSchema>

/** Normalized hyperlink row for UI (no pricing fields). */
export const materialChecklistLinkItemSchema = z.object({
  name: z.string().min(1),
  required: z.boolean(),
  affiliate_url: z.string().url().nullable(),
  /** Public path or absolute URL for prop reference art (e.g. cryptic symbols). */
  image_url: z.string().min(1).optional(),
  display_note: z.string().optional(),
})

export type MaterialChecklistLinkItem = z.infer<typeof materialChecklistLinkItemSchema>

export const processedMaterialChecklistSchema = z.object({
  items: z.array(materialChecklistLinkItemSchema),
})

export type ProcessedMaterialChecklistPayload = z.infer<typeof processedMaterialChecklistSchema>
