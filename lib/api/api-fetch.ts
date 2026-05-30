/**
 * Same-origin JSON fetch for Popup Hub API routes.
 * Supabase session cookies are sent automatically (credentials: 'same-origin').
 */
export class ApiFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message)
    this.name = 'ApiFetchError'
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
  })

  const data = (await response.json().catch(() => null)) as
    | T
    | { error?: string; code?: string }
    | null

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed (${response.status})`
    const code =
      data && typeof data === 'object' && 'code' in data && typeof data.code === 'string'
        ? data.code
        : undefined
    throw new ApiFetchError(message, response.status, code)
  }

  return data as T
}
