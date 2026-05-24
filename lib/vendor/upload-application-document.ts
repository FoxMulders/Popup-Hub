import type { SupabaseClient } from '@supabase/supabase-js'

const VENDOR_ASSETS_BUCKET = 'vendor-assets'

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function uploadApplicationDocument(
  supabase: SupabaseClient,
  userId: string,
  file: File,
  kind: 'permit' | 'insurance',
  applicationId?: string,
): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('Upload a PDF or image file (JPEG, PNG, or WebP).')
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'pdf'
  const suffix = applicationId ? `${applicationId}-` : ''
  const path = `${userId}/application-docs/${kind}-${suffix}${Date.now()}-${sanitizeFileName(file.name || `document.${ext}`)}`

  const { error } = await supabase.storage.from(VENDOR_ASSETS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  })

  if (error) {
    throw new Error(`Failed to upload document: ${error.message}`)
  }

  const { data } = supabase.storage.from(VENDOR_ASSETS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
