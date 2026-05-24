/** Platform e-transfer deposit address for wallet top-ups. */
export function getWalletEtransferEmail(): string | null {
  const fromEnv =
    process.env.WALLET_ETRANSFER_EMAIL?.trim() ||
    process.env.POPUP_HUB_ETRANSFER_EMAIL?.trim()
  return fromEnv || null
}

/** Consumer banking portals — patrons open their bank to send Interac e-Transfer. */
export const BANKING_PORTAL_LINKS = [
  { label: 'Interac e-Transfer', href: 'https://www.interac.ca/en/interac-e-transfer/' },
  { label: 'TD Canada', href: 'https://easyweb.td.com/' },
  { label: 'RBC Royal Bank', href: 'https://www1.roybank.com/' },
  { label: 'BMO', href: 'https://www1.bmo.com/' },
  { label: 'Scotiabank', href: 'https://www.scotiaonline.scotiabank.com/' },
  { label: 'CIBC', href: 'https://www.cibconline.cibc.com/' },
] as const
