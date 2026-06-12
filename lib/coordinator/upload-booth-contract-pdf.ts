import type { SupabaseClient } from '@supabase/supabase-js'

const EVENT_ASSETS_BUCKET = 'event-assets'
const MAX_PDF_BYTES = 10 * 1024 * 1024

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function uploadBoothContractPdf(
  supabase: SupabaseClient,
  coordinatorId: string,
  eventId: string,
  file: File
): Promise<string> {
  if (file.type !== 'application/pdf') {
    throw new Error('Upload a PDF contract file.')
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error('PDF must be 10 MB or smaller.')
  }

  const path = `events/${coordinatorId}/${eventId}/booth-contract-${Date.now()}-${sanitizeFileName(file.name || 'contract.pdf')}`

  const { error } = await supabase.storage.from(EVENT_ASSETS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: 'application/pdf',
  })

  if (error) {
    throw new Error(`Failed to upload contract PDF: ${error.message}`)
  }

  const { data } = supabase.storage.from(EVENT_ASSETS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
