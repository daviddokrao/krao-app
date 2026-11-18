import {describe, expect, it} from '@jest/globals'

import {
  extractEvmAddresses,
  MAX_ADDRESSES_PER_TEXT,
  splitAddress,
} from '../addresses'

const ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const OTHER = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'

describe('extractEvmAddresses', () => {
  it('finds addresses in text, lowercase, once each, in order', () => {
    expect(
      extractEvmAddresses(
        `Send to ${ADDRESS}, not ${OTHER}. Again ${ADDRESS.toLowerCase()}`,
      ),
    ).toEqual([ADDRESS.toLowerCase(), OTHER.toLowerCase()])
  })

  it('needs 0x and exactly 40 hex characters', () => {
    expect(extractEvmAddresses('no address here')).toEqual([])
    expect(extractEvmAddresses(ADDRESS.slice(0, -1))).toEqual([])
    // A longer hex run is a hash, not an address
    expect(extractEvmAddresses(`${ADDRESS}a`)).toEqual([])
    expect(extractEvmAddresses(`0x${'ab'.repeat(32)}`)).toEqual([])
    expect(extractEvmAddresses(ADDRESS.slice(2))).toEqual([])
  })

  it('finds an address next to punctuation and in links', () => {
    expect(extractEvmAddresses(`(${ADDRESS})`)).toHaveLength(1)
    expect(
      extractEvmAddresses(`https://basescan.org/address/${ADDRESS}`),
    ).toHaveLength(1)
  })

  it('stops after a few addresses', () => {
    const many = Array.from(
      {length: 12},
      (_, i) => `0x${i.toString(16).padStart(40, '0')}`,
    ).join(' ')
    expect(extractEvmAddresses(many)).toHaveLength(MAX_ADDRESSES_PER_TEXT)
  })
})

describe('splitAddress', () => {
  it('sets apart the first 6 and last 4 characters', () => {
    const {head, middle, tail} = splitAddress(ADDRESS)
    expect(head).toBe('0x8335')
    expect(tail).toBe('2913')
    expect(head + middle + tail).toBe(ADDRESS)
    expect(middle).toHaveLength(32)
  })

  it('keeps short text whole', () => {
    expect(splitAddress('0x1234')).toEqual({
      head: '0x1234',
      middle: '',
      tail: '',
    })
  })
})
