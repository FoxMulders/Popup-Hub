/**
 * Detect a genuine manual identity-link OAuth callback.
 *
 * The `link=1` query flag alone is forgeable on sign-in/sign-up OAuth redirects.
 * A real link flow must have had an authenticated session before code exchange
 * and must resolve to the same auth user afterward.
 */
export function isGenuineOAuthLinkFlow(
  linkFlag: boolean,
  userIdBeforeExchange: string | undefined,
  userIdAfterExchange: string
): boolean {
  return linkFlag && !!userIdBeforeExchange && userIdBeforeExchange === userIdAfterExchange
}
