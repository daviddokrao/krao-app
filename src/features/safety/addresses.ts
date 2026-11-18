import {createBatchLoader} from '#/lib/batchLoader'
import {type AddressResult, checkAddressesRequest} from './api'

/*
 * EVM addresses in text, and address poisoning: an attacker makes a wallet
 * whose first and last characters match one the victim knows and hopes the
 * victim copies the wrong one. Krao's indexer knows the wallets accounts
 * verified, and says which of them look like an address.
 */

/** 0x and 40 hex characters, not part of a longer hex or word run */
const EVM_ADDRESS_RE = /(?<![0-9a-z])0x[0-9a-f]{40}(?![0-9a-z])/gi

/** At most this many addresses of a text are checked (the service takes 20) */
export const MAX_ADDRESSES_PER_TEXT = 5

/** The distinct EVM addresses in `text`, lowercase, in order of appearance */
export function extractEvmAddresses(text: string): string[] {
  if (!text.includes('0x') && !text.includes('0X')) return []
  const found = new Set<string>()
  for (const match of text.matchAll(EVM_ADDRESS_RE)) {
    found.add(match[0].toLowerCase())
    if (found.size >= MAX_ADDRESSES_PER_TEXT) break
  }
  return [...found]
}

/**
 * An address in three parts: the first 6 characters ("0x" and 4 hex) and the
 * last 4 are what a lookalike copies and what people compare, so they are
 * shown apart from the middle.
 */
export function splitAddress(address: string): {
  head: string
  middle: string
  tail: string
} {
  if (address.length <= 10) return {head: address, middle: '', tail: ''}
  return {
    head: address.slice(0, 6),
    middle: address.slice(6, -4),
    tail: address.slice(-4),
  }
}

const loadAddress = createBatchLoader<string, AddressResult>({
  maxBatchSize: 20,
  load: async addresses => {
    const results = await checkAddressesRequest(addresses)
    return new Map(results.map(r => [r.address.toLowerCase(), r]))
  },
})

/** What the indexer knows about an address (lowercase) */
export function getAddressSafety(address: string) {
  return loadAddress(address.toLowerCase())
}
