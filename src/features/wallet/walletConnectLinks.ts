/*
 * Pure helpers for connecting wallet apps through WalletConnect on native.
 * Kept free of the WalletConnect packages so they run (and test) anywhere.
 */

/**
 * Where a wallet app sends the user back to. `intent/wallet` is an inert
 * intent: the link handler ignores it, so returning from the wallet does not
 * navigate away from the dialog or screen that asked for the signature.
 */
export const WALLET_REDIRECT_NATIVE = 'krao://intent/wallet'

/**
 * Wallet apps to try, in order, for a WalletConnect pairing URI. Each is a
 * deep link scheme the wallet registers; the first one that is installed
 * opens. The bare `wc:` link comes last for wallets that register it.
 */
const WALLET_LINKS: ((uri: string) => string)[] = [
  uri => `metamask://wc?uri=${encodeURIComponent(uri)}`,
  uri => `trust://wc?uri=${encodeURIComponent(uri)}`,
  uri => `rainbow://wc?uri=${encodeURIComponent(uri)}`,
  uri => `cbwallet://wc?uri=${encodeURIComponent(uri)}`,
  uri => uri,
]

export function walletPairingLinks(wcUri: string): string[] {
  return WALLET_LINKS.map(build => build(wcUri))
}

/** JSON-RPC methods that wait for the user to approve inside the wallet app */
const APPROVAL_METHODS = new Set([
  'personal_sign',
  'eth_sendTransaction',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
])

export function needsWalletApproval(method: string): boolean {
  return APPROVAL_METHODS.has(method)
}

/** Schemes a wallet's redirect may never name (it is peer-supplied data) */
const BLOCKED_SCHEMES = new Set([
  'http',
  'file',
  'javascript',
  'data',
  'blob',
  'content',
  'intent',
  'about',
  'vbscript',
  // Our own scheme: a peer must not drive the app's own deep links
  'krao',
  // System handlers that would dial, text or mail on the wallet's say-so
  'tel',
  'telprompt',
  'sms',
  'mailto',
  'facetime',
  'facetime-audio',
])

/**
 * The deep link that brings an already connected wallet app to the front
 * (from the redirect metadata it gave us when the session was approved).
 * Only https links and the wallet's own app scheme (`metamask://`) are used.
 */
export function walletOpenLink(
  redirect?: {native?: string; universal?: string} | null,
): string | undefined {
  for (const link of [redirect?.native, redirect?.universal]) {
    const scheme = link?.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]?.toLowerCase()
    if (link && scheme && !BLOCKED_SCHEMES.has(scheme)) return link
  }
  return undefined
}

/**
 * WalletConnect wallets reject with code 5000 (USER_REJECTED) or a message,
 * where injected wallets use EIP-1193 code 4001.
 */
export function isUserRejection(err: unknown): boolean {
  const {code, message} = (err ?? {}) as {code?: number; message?: string}
  if (code === 4001 || code === 5000) return true
  return (
    typeof message === 'string' &&
    /user (rejected|denied|cancel)/i.test(message)
  )
}

export type Eip1193Provider = {
  request: (args: {method: string; params?: unknown[]}) => Promise<unknown>
}

/** What the native WalletConnect provider module offers */
export type WalletConnectApi = {
  /**
   * A connected EIP-1193 provider. Opens a wallet app to pair when there is no
   * session yet, or always when `fresh` is set (to pick another wallet).
   */
  getProvider: (opts?: {fresh?: boolean}) => Promise<Eip1193Provider>
}
