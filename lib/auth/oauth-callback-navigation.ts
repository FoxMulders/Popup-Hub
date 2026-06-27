/** Server OAuth exchange path — must be hit via full document navigation (not client router). */
export function buildServerOAuthCallbackHref(query: string): string {
  return query ? `/api/auth/callback?${query}` : '/api/auth/callback'
}

/**
 * Navigate to the OAuth callback route handler.
 * Uses `location.replace` so the browser stores Set-Cookie from the redirect response;
 * `router.push` would fetch the route and drop session cookies.
 */
export function navigateToOAuthCallback(query: string): void {
  window.location.replace(buildServerOAuthCallbackHref(query))
}
