import {createBatchLoader} from '#/lib/batchLoader'
import {KRAO_INDEXER_URL} from '#/env'

export type WalletStatus = 'verified' | 'pending' | 'invalid'

export type LinkedWallet = {
  uri: string
  account: string
  label?: string
  status: WalletStatus
  /** Why an invalid wallet does not count (from the indexer, in English) */
  reason?: string
  /** False when the owner hid this wallet's Basename/ENS name */
  showPrimaryName?: boolean
  createdAt?: string
}

export type NftRef = {
  chain: string
  contract: string
  tokenId: string
  standard?: string
}

export type NftAvatar = {
  nft: NftRef
  wallet: string
  status: WalletStatus
  collectionName?: string
  image?: string
  checkedAt?: string
}

export type BadgeId =
  | 'wallet-verified'
  | 'nft-avatar'
  | 'tipper'
  | 'supported'
  /** Krao: a real person (verified phone or identity), when they show it */
  | 'human'

/** A Basename or ENS name that points to a wallet verified for the account */
export type PrimaryName = {
  name: string
  source: 'basename' | 'ens'
  address: string
}

export type ChainProfile = {
  did: string
  wallets: LinkedWallet[]
  nftAvatar?: NftAvatar
  tipsReceivedCount?: number
  badges?: {id: string; count?: number}[]
  primaryName?: PrimaryName
}

export type ResolvedNft = {
  nft: NftRef
  owner?: string
  ownedByQueried?: boolean
  collectionName?: string
  name?: string
  image?: string
}

/** Output of net.krao.server.createWalletSession (same as createSession) */
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
  {
    params,
    body,
  }: {params?: Record<string, string | string[]>; body?: unknown} = {},
): Promise<T> {
  const url = new URL(`/xrpc/${method}`, service)
  for (const [k, v] of Object.entries(params ?? {})) {
    for (const item of [v].flat()) url.searchParams.append(k, item)
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

const loadChainProfile = createBatchLoader<string, ChainProfile>({
  maxBatchSize: 25,
  load: async dids => {
    const {profiles} = await xrpc<{profiles: ChainProfile[]}>(
      KRAO_INDEXER_URL,
      'net.krao.actor.getChainProfiles',
      {params: {actors: dids}},
    )
    return new Map(profiles.map(p => [p.did, p]))
  },
})

/**
 * Linked wallets, NFT avatar and badges of an account, from the Krao
 * indexer. Lookups made together (eg for every author in a feed) share one
 * request.
 */
export async function getChainProfile(did: string): Promise<ChainProfile> {
  return (await loadChainProfile(did)) ?? {did, wallets: []}
}

/** Look up an NFT on-chain via the Krao indexer */
export function resolveNft(params: {
  chain: string
  contract: string
  tokenId: string
  owner?: string
}) {
  return xrpc<ResolvedNft>(KRAO_INDEXER_URL, 'net.krao.actor.resolveNft', {
    params: Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined),
    ),
  })
}

/** URL of the NFT's image as a 512px PNG, rendered by the Krao indexer */
export function nftImageUrl(nft: NftRef): string {
  const url = new URL('/nft-image', KRAO_INDEXER_URL)
  url.searchParams.set('chain', nft.chain)
  url.searchParams.set('contract', nft.contract)
  url.searchParams.set('tokenId', nft.tokenId)
  return url.toString()
}

export function getWalletChallenge(service: string, account: string) {
  return xrpc<{message: string; expiresAt: string}>(
    service,
    'net.krao.server.getWalletChallenge',
    {params: {account}},
  )
}

export function createWalletSession(
  service: string,
  body: {account: string; message: string; signature: string},
) {
  return xrpc<WalletSession>(service, 'net.krao.server.createWalletSession', {
    body,
  })
}
