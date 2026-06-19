const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3'
const GOOGLE_DOCS_EXPORT = 'https://docs.googleapis.com/v1/documents'

export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
].join(' ')

export function getGoogleOAuthClientId(): string | null {
  return process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || null
}

export function getGoogleOAuthClientSecret(): string | null {
  return process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || null
}

export function getGoogleOAuthRedirectUri(origin: string): string {
  const fromEnv = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim()
  if (fromEnv) return fromEnv
  return `${origin.replace(/\/$/, '')}/api/coordinator/google/oauth/callback`
}

export function buildGoogleOAuthUrl(params: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const url = new URL(GOOGLE_AUTH_BASE)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_OAUTH_SCOPES)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', params.state)
  return url.toString()
}

export async function exchangeGoogleOAuthCode(input: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<{
  access_token: string
  refresh_token?: string
  expires_in?: number
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const json = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
  }

  if (!res.ok || !json.access_token) {
    throw new Error(json.error ?? 'Google token exchange failed')
  }

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in,
  }
}

export async function refreshGoogleAccessToken(input: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<{ access_token: string; expires_in?: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string }
  if (!res.ok || !json.access_token) {
    throw new Error(json.error ?? 'Google token refresh failed')
  }
  return { access_token: json.access_token, expires_in: json.expires_in }
}

export interface GoogleDocListItem {
  id: string
  name: string
  modifiedTime?: string
}

export async function listGoogleDocs(accessToken: string): Promise<GoogleDocListItem[]> {
  const url = new URL(`${GOOGLE_DRIVE_API}/files`)
  url.searchParams.set('q', "mimeType='application/vnd.google-apps.document' and trashed=false")
  url.searchParams.set('fields', 'files(id,name,modifiedTime)')
  url.searchParams.set('pageSize', '25')
  url.searchParams.set('orderBy', 'modifiedTime desc')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const json = (await res.json()) as { files?: GoogleDocListItem[]; error?: { message?: string } }
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to list Google Docs')
  return json.files ?? []
}

export async function exportGoogleDocPlainText(
  accessToken: string,
  docId: string
): Promise<string> {
  const res = await fetch(`${GOOGLE_DRIVE_API}/files/${docId}/export?mimeType=text/plain`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error('Failed to export Google Doc')
  }
  return res.text()
}

export async function fetchGoogleDocTitle(accessToken: string, docId: string): Promise<string> {
  const res = await fetch(`${GOOGLE_DOCS_EXPORT}/${docId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = (await res.json()) as { title?: string }
  return json.title ?? 'Imported contract'
}
