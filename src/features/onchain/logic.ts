import {formatUnits} from '#/features/tips/assets'

/*
 * The shapes of net.krao.actor.getOnchainProfile and getSupportHistory, and
 * the pure rules for showing them. Typed here, like the other indexer
 * methods the app calls before the lexicons are vendored.
 */

export type OnchainWallet = {
  chain: string
  address: string
  label?: string
}

export type OnchainNft = {
  chain: string
  contract: string
  /** Missing for a collection entry (no enumeration, or ERC-1155) */
  tokenId?: string
  balance: string
  collectionName?: string
  name?: string
  image?: string
  isAvatar: boolean
}

export type SupportSummary = {
  /** US dollars, decimal string */
  tipsSentUsd: string
  tipsReceivedUsd: string
  tipsSent: number
  tipsReceived: number
  membershipsActive: number
  membersActive: number
}

export type OnchainProfile = {
  did: string
  primaryName?: {
    name: string
    source: 'basename' | 'ens'
    address: string
  }
  wallets: OnchainWallet[]
  nfts: OnchainNft[]
  support: SupportSummary
}

export type SupportDirection = 'sent' | 'received'

export type SupportItem = {
  kind: 'tip' | 'membership'
  uri: string
  cid?: string
  from: string
  to: string
  /** Base units */
  amount: string
  asset: {symbol: string; decimals: number; chain: string; address?: string}
  usd?: string
  txHash: string
  createdAt: string
}

const isPositive = (value: string | undefined) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0
}

/** Whether there is anything to show: the tab is hidden otherwise */
export function hasOnchainContent(
  profile: OnchainProfile | undefined | null,
): boolean {
  if (!profile) return false
  if (profile.wallets?.length > 0 || profile.nfts?.length > 0) return true
  const s = profile.support
  return (
    !!s &&
    (isPositive(s.tipsSentUsd) ||
      isPositive(s.tipsReceivedUsd) ||
      s.tipsSent > 0 ||
      s.tipsReceived > 0 ||
      s.membershipsActive > 0 ||
      s.membersActive > 0)
  )
}

/** A key for a list of NFT entries (a collection entry has no token) */
export function nftKey(nft: OnchainNft): string {
  return `${nft.chain}:${nft.contract.toLowerCase()}:${nft.tokenId ?? '*'}`
}

/** Title of an NFT card: its name, else the collection with the token id */
export function nftTitle(nft: OnchainNft): string {
  if (nft.name) return nft.name
  const collection = nft.collectionName || shortHex(nft.contract)
  return nft.tokenId ? `${collection} #${nft.tokenId}` : collection
}

/** "0x1234...abcd" for long hex strings (addresses, hashes) */
export function shortHex(value: string, head = 6, tail = 4): string {
  return value.length > head + tail + 3
    ? `${value.slice(0, head)}...${value.slice(-tail)}`
    : value
}

/**
 * The amount of a support item as people read it: "5 USDC". An unusable
 * amount shows as the symbol alone.
 */
export function formatSupportAmount(item: SupportItem): string {
  try {
    return `${formatUnits(item.amount, item.asset.decimals)} ${item.asset.symbol}`
  } catch {
    return item.asset.symbol
  }
}

/**
 * Joins the pages of the history without repeating items (a page can overlap
 * the previous when tips arrive between fetches).
 */
export function mergeSupportPages(
  pages: {items: SupportItem[]}[] | undefined,
): SupportItem[] {
  const seen = new Set<string>()
  const out: SupportItem[] = []
  for (const page of pages ?? []) {
    for (const item of page.items) {
      if (seen.has(item.uri)) continue
      seen.add(item.uri)
      out.push(item)
    }
  }
  return out
}

/** The other side of a support item, seen from the profile owner's side */
export function counterpartyDid(
  item: SupportItem,
  direction: SupportDirection,
): string {
  return direction === 'sent' ? item.to : item.from
}
