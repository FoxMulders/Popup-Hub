import type { SupabaseClient } from '@supabase/supabase-js'

const VENDOR_ASSETS_BUCKET = 'vendor-assets'

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Upload a vendor logo or product photo to `{userId}/…` in the public vendor-assets bucket.
 * Returns the full public URL stored on vendor_passports rows.
 */
export async function uploadVendorAsset(
  supabase: SupabaseClient,
  userId: string,
  file: File,
  kind: 'logo' | 'item'
): Promise<string> {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'jpg'
  const baseName =
    kind === 'logo'
      ? `logo-${Date.now()}.${ext}`
      : `item-${Date.now()}-${sanitizeFileName(file.name)}`
  const path = `${userId}/${baseName}`

  const { error } = await supabase.storage.from(VENDOR_ASSETS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  })

  if (error) {
    console.error('CRITICAL VENDOR ASSET UPLOAD ERROR:', error.message, error)
    throw new Error(`Failed to upload ${kind}: ${error.message}`)
  }

  const { data } = supabase.storage.from(VENDOR_ASSETS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
