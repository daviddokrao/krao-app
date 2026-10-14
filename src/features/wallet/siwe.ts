/**
 * Sign-In With Ethereum (EIP-4361) messages. Mirrors `formatSignInMessage` in
 * krao-atproto's @krao/wallet package, which verifies them server side.
 */
export type SignInMessage = {
  domain: string
  address: string
  statement?: string
  uri: string
  chainId: number
  nonce: string
  issuedAt: string
  expirationTime?: string
  resources?: string[]
}

export function formatSiweMessage(msg: SignInMessage): string {
  const lines = [
    `${msg.domain} wants you to sign in with your Ethereum account:`,
    msg.address,
    '',
  ]
  if (msg.statement) {
    lines.push(msg.statement, '')
  }
  lines.push(
    `URI: ${msg.uri}`,
    'Version: 1',
    `Chain ID: ${msg.chainId}`,
    `Nonce: ${msg.nonce}`,
    `Issued At: ${msg.issuedAt}`,
  )
  if (msg.expirationTime) {
    lines.push(`Expiration Time: ${msg.expirationTime}`)
  }
  if (msg.resources?.length) {
    lines.push('Resources:', ...msg.resources.map(r => `- ${r}`))
  }
  return lines.join('\n')
}

/**
 * Message a wallet signs to link itself to an account. Naming the DID as the
 * URI is what stops the proof from being reused for another account.
 */
export function formatWalletLinkMessage({
  address,
  chainId,
  did,
}: {
  address: string
  chainId: number
  did: string
}): string {
  return formatSiweMessage({
    domain: 'krao.net',
    address,
    statement: 'Link this wallet to my Krao account.',
    uri: did,
    chainId,
    nonce: randomNonce(),
    issuedAt: new Date().toISOString(),
  })
}

function randomNonce(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/** CAIP-10 account id for an EVM address on a chain */
export function evmAccountId(chainId: number, address: string): string {
  return `eip155:${chainId}:${address}`
}

/** Shortened address for display, eg 0xab16…fcdb */
export function shortAddress(accountId: string): string {
  const address = accountId.split(':').pop() ?? accountId
  return address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address
}
