/** Supabase Supavisor transaction pooler (serverless-safe). */
export const SUPABASE_POOLER_PORT = 6543

/** Direct Postgres port — avoid for app server traffic at scale. */
export const SUPABASE_DIRECT_PORT = 5432

let poolerWarningLogged = false

function normalizePostgresUrl(raw: string): URL {
  return new URL(raw.replace(/^postgres(ql)?:\/\//, 'https://'))
}

/**
 * Returns DATABASE_URL when set. Popup Hub uses the Supabase HTTP client for
 * application queries; this URL is for migrations, scripts, and future direct SQL.
 */
export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL?.trim() || undefined
}

/**
 * Warn once when DATABASE_URL targets the direct database port instead of the pooler.
 * Production/staging should use Supavisor on port 6543 (transaction mode).
 */
export function assertTransactionPoolerConfigured(url = getDatabaseUrl()): void {
  if (!url || poolerWarningLogged) return

  try {
    const parsed = normalizePostgresUrl(url)
    const port = parsed.port ? Number(parsed.port) : SUPABASE_DIRECT_PORT

    if (port === SUPABASE_DIRECT_PORT) {
      poolerWarningLogged = true
      console.warn(
        `[db] DATABASE_URL uses direct port ${SUPABASE_DIRECT_PORT}. ` +
          `For viral scale and serverless, point DATABASE_URL to the Supabase transaction pooler on port ${SUPABASE_POOLER_PORT}.`
      )
    }
  } catch {
    poolerWarningLogged = true
    console.warn('[db] DATABASE_URL is set but could not be parsed for pooler validation.')
  }
}

export function isTransactionPoolerUrl(url = getDatabaseUrl()): boolean {
  if (!url) return false

  try {
    const parsed = normalizePostgresUrl(url)
    const port = parsed.port ? Number(parsed.port) : SUPABASE_DIRECT_PORT
    return port === SUPABASE_POOLER_PORT
  } catch {
    return false
  }
}
