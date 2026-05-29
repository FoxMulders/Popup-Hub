/** Actionable message when hosted Supabase is missing migration 086/088 columns. */
export const EVENTS_SCHEMA_MIGRATION_MESSAGE =
  'Database migration required — run `supabase db push` or apply migration 088 in the Supabase SQL Editor.'

type PostgrestErrorShape = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

export function isPostgrestSchemaCacheError(error: PostgrestErrorShape): boolean {
  if (error.code === 'PGRST204') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('schema cache') || (msg.includes('could not find') && msg.includes('column'))
}

export function formatSupabaseClientError(error: PostgrestErrorShape): string {
  if (isPostgrestSchemaCacheError(error)) {
    return EVENTS_SCHEMA_MIGRATION_MESSAGE
  }
  return [error.message, error.details, error.hint, error.code].filter(Boolean).join(' — ')
}

export function errorFromSupabase(error: PostgrestErrorShape): Error {
  return new Error(formatSupabaseClientError(error))
}

/** Normalize thrown values from Supabase client catch blocks. */
export function formatUnknownSaveError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return formatSupabaseClientError(err as PostgrestErrorShape)
  }
  if (err instanceof Error) return err.message
  return 'Save failed'
}
