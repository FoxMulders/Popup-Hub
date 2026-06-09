import type { SupabaseClient } from '@supabase/supabase-js'

const VENDOR_ASSETS_BUCKET = 'vendor-assets'
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png'])
const MAX_BYTES = 5 * 1024 * 1024

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function uploadFeatureScreenshot(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('Upload a PNG or JPG screenshot.')
  }

  if (file.size > MAX_BYTES) {
    throw new Error('Screenshots must be 5 MB or smaller.')
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'jpg'
  const path = `${userId}/feature-requests/screenshot-${Date.now()}-${sanitizeFileName(file.name || `evidence.${ext}`)}`

  const { error } = await supabase.storage.from(VENDOR_ASSETS_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  })

  if (error) {
    throw new Error(`Screenshot upload failed: ${error.message}`)
  }

  const { data } = supabase.storage.from(VENDOR_ASSETS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
