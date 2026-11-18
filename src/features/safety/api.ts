import {KRAO_INDEXER_URL, KRAO_REWARDS_URL} from '#/env'

/*
 * The public safety methods of Krao's services: net.krao.safety.checkLinks
 * and checkAddresses (the indexer) and net.krao.kyc.getBadges (rewards).
 * None needs a session.
 */

export type LinkResult = {
  url: string
  unsafe: boolean
  /** The listed domain the link's host matched */
  domain?: string
  reason?: string
}

export type AddressResult = {
  /** Lowercase */
  address: string
  owner?: string
  matchesExpected?: boolean
  /** Verified wallets of other accounts that look like this address */
  lookalikes: {address: string; did: string}[]
}

export class SafetyError extends Error {
  constructor(
    public error: string | undefined,
    message: string,
  ) {
    super(message)
  }
}

async function call<T>(
  service: string,
  method: string,
  {params, body}: {params?: Record<string, string[]>; body?: unknown} = {},
): Promise<T> {
  const url = new URL(`/xrpc/${method}`, service)
  for (const [k, values] of Object.entries(params ?? {})) {
    for (const v of values) url.searchParams.append(k, v)
  }
  const res = await fetch(url.toString(), {
    method: body !== undefined ? 'POST' : 'GET',
    headers: body !== undefined ? {'content-type': 'application/json'} : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const {error, message} = data as {error?: string; message?: string}
    throw new SafetyError(error, message ?? `${method} failed`)
  }
  return data as T
}

/** At most 20 URLs; the answers are in the order given */
export async function checkLinksRequest(urls: string[]): Promise<LinkResult[]> {
  const {results} = await call<{results: LinkResult[]}>(
    KRAO_INDEXER_URL,
    'net.krao.safety.checkLinks',
    {body: {urls}},
  )
  return results
}

/** At most 20 addresses; the answers are in the order given */
export async function checkAddressesRequest(
  addresses: string[],
  expectedDid?: string,
): Promise<AddressResult[]> {
  const {results} = await call<{results: AddressResult[]}>(
    KRAO_INDEXER_URL,
    'net.krao.safety.checkAddresses',
    {body: {addresses, ...(expectedDid ? {expectedDid} : {})}},
  )
  return results
}

/** The badges of up to 50 accounts; accounts with none are left out */
export async function getBadgesRequest(
  dids: string[],
): Promise<{did: string; badges: string[]}[]> {
  const {actors} = await call<{actors: {did: string; badges: string[]}[]}>(
    KRAO_REWARDS_URL,
    'net.krao.kyc.getBadges',
    {params: {dids}},
  )
  return actors
}
