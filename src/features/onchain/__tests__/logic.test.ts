import {describe, expect, it} from '@jest/globals'

import {
  counterpartyDid,
  formatSupportAmount,
  hasOnchainContent,
  mergeSupportPages,
  nftKey,
  nftTitle,
  type OnchainProfile,
  shortHex,
  type SupportItem,
} from '../logic'

const empty: OnchainProfile = {
  did: 'did:plc:a',
  wallets: [],
  nfts: [],
  support: {
    tipsSentUsd: '0',
    tipsReceivedUsd: '0.00',
    tipsSent: 0,
    tipsReceived: 0,
    membershipsActive: 0,
    membersActive: 0,
  },
}

const item = (over: Partial<SupportItem> = {}): SupportItem => ({
  kind: 'tip',
  uri: 'at://did:plc:a/net.krao.feed.tip/1',
  from: 'did:plc:a',
  to: 'did:plc:b',
  amount: '5000000',
  asset: {symbol: 'USDC', decimals: 6, chain: 'eip155:8453'},
  txHash: '0xabc',
  createdAt: '2026-10-16T00:00:00.000Z',
  ...over,
})

describe('hasOnchainContent', () => {
  it('is false without data or with all zeros', () => {
    expect(hasOnchainContent(undefined)).toBe(false)
    expect(hasOnchainContent(null)).toBe(false)
    expect(hasOnchainContent(empty)).toBe(false)
  })
  it('is true with a wallet, an NFT or any support', () => {
    expect(
      hasOnchainContent({
        ...empty,
        wallets: [{chain: 'eip155:8453', address: '0x1'}],
      }),
    ).toBe(true)
    expect(
      hasOnchainContent({
        ...empty,
        nfts: [{chain: 'c', contract: '0x1', balance: '1', isAvatar: false}],
      }),
    ).toBe(true)
    expect(
      hasOnchainContent({
        ...empty,
        support: {...empty.support, tipsReceivedUsd: '12.50'},
      }),
    ).toBe(true)
    expect(
      hasOnchainContent({
        ...empty,
        support: {...empty.support, membersActive: 2},
      }),
    ).toBe(true)
  })
})

describe('formatSupportAmount', () => {
  it('shows base units as a decimal with the symbol', () => {
    expect(formatSupportAmount(item())).toBe('5 USDC')
    expect(
      formatSupportAmount(
        item({
          amount: '1500000000000000',
          asset: {symbol: 'ETH', decimals: 18, chain: 'eip155:8453'},
        }),
      ),
    ).toBe('0.0015 ETH')
  })
  it('survives a broken amount', () => {
    expect(formatSupportAmount(item({amount: 'nope'}))).toBe('USDC')
  })
})

describe('mergeSupportPages', () => {
  it('joins pages and drops repeats', () => {
    const a = item({uri: 'at://x/1'})
    const b = item({uri: 'at://x/2'})
    const merged = mergeSupportPages([
      {items: [a, b]},
      {items: [b, item({uri: 'at://x/3'})]},
    ])
    expect(merged.map(i => i.uri)).toEqual(['at://x/1', 'at://x/2', 'at://x/3'])
    expect(mergeSupportPages(undefined)).toEqual([])
  })
})

describe('counterpartyDid', () => {
  it('is the recipient for sent and the sender for received', () => {
    expect(counterpartyDid(item(), 'sent')).toBe('did:plc:b')
    expect(counterpartyDid(item(), 'received')).toBe('did:plc:a')
  })
})

describe('nft helpers', () => {
  it('titles an NFT by name, else collection and token', () => {
    const base = {chain: 'c', contract: '0xAbC', balance: '1', isAvatar: false}
    expect(nftTitle({...base, name: 'Ape', tokenId: '4'})).toBe('Ape')
    expect(nftTitle({...base, collectionName: 'Apes', tokenId: '4'})).toBe(
      'Apes #4',
    )
    expect(nftTitle({...base, collectionName: 'Apes'})).toBe('Apes')
  })
  it('keys by contract (any case) and token', () => {
    const base = {chain: 'c', balance: '1', isAvatar: false}
    expect(nftKey({...base, contract: '0xAB', tokenId: '1'})).toBe(
      nftKey({...base, contract: '0xab', tokenId: '1'}),
    )
    expect(nftKey({...base, contract: '0xab'})).not.toBe(
      nftKey({...base, contract: '0xab', tokenId: '1'}),
    )
  })
})

describe('shortHex', () => {
  it('cuts the middle of long values only', () => {
    expect(shortHex('0x1234567890abcdef1234567890abcdef12345678')).toBe(
      '0x1234...5678',
    )
    expect(shortHex('0x12')).toBe('0x12')
  })
})
