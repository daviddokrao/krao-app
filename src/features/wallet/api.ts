import {KRAO_INDEXER_URL} from '#/env'

export type WalletStatus = 'verified' | 'pending' | 'invalid'

export type LinkedWallet = {
  uri: string
  account: string
  label?: string
  status: WalletStatus
  createdAt?: string
}

export type ChainProfile = {
  did: string
  wallets: LinkedWallet[]
}

/** Output of io.krao.server.createWalletSession (same as createSession) */
export type WalletSession = {
  accessJwt: string
  refreshJwt: string
  handle: string
  did: string
  didDoc?: unknown
  email?: string
  emailConfirmed?: boolean
  emailAuthFactor?: boolean
  active?: boolean
  status?: string
}

export class XrpcError extends Error {
  constructor(
    public error: string | undefined,
    message: string,
  ) {
    super(message)
  }
}

async function xrpc<T>(
  service: string,
  method: string,
  {params, body}: {params?: Record<string, string>; body?: unknown} = {},
): Promise<T> {
  const url = new URL(`/xrpc/${method}`, service)
  for (const [k, v] of Object.entries(params ?? {})) {
    url.searchParams.append(k, v)
  }
  const res = await fetch(url.toString(), {
    method: body ? 'POST' : 'GET',
    headers: body ? {'content-type': 'application/json'} : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    message?: string
  }
  if (!res.ok) {
    throw new XrpcError(data.error, data.message ?? `${method} failed`)
  }
  return data as T
}

/** Linked wallets for an account, from the Krao indexer */
export async function getChainProfile(did: string): Promise<ChainProfile> {
  const {profiles} = await xrpc<{profiles: ChainProfile[]}>(
    KRAO_INDEXER_URL,
    'io.krao.actor.getChainProfiles',
    {params: {actors: did}},
  )
  return profiles.find(p => p.did === did) ?? {did, wallets: []}
}

export function getWalletChallenge(service: string, account: string) {
  return xrpc<{message: string; expiresAt: string}>(
    service,
    'io.krao.server.getWalletChallenge',
    {params: {account}},
  )
}

export function createWalletSession(
  service: string,
  body: {account: string; message: string; signature: string},
) {
  return xrpc<WalletSession>(service, 'io.krao.server.createWalletSession', {
    body,
  })
}
