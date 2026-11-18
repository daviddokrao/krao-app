import {describe, expect, it} from '@jest/globals'

import {
  evmAccountId,
  formatSiweMessage,
  formatWalletLinkMessage,
  shortAddress,
  type SignInMessage,
} from '../siwe'

const base: SignInMessage = {
  domain: 'krao.net',
  address: '0xAb16A96D359eC26a11e2C2b3d8f8B8942d5Bfcdb',
  uri: 'did:plc:abc123',
  chainId: 8453,
  nonce: 'deadbeef',
  issuedAt: '2026-01-01T00:00:00.000Z',
}

describe('formatSiweMessage', () => {
  it('formats a minimal message', () => {
    expect(formatSiweMessage(base)).toBe(
      [
        'krao.net wants you to sign in with your Ethereum account:',
        base.address,
        '',
        'URI: did:plc:abc123',
        'Version: 1',
        'Chain ID: 8453',
        'Nonce: deadbeef',
        'Issued At: 2026-01-01T00:00:00.000Z',
      ].join('\n'),
    )
  })

  it('includes the statement between blank lines', () => {
    const lines = formatSiweMessage({...base, statement: 'Hello.'}).split('\n')
    expect(lines.slice(1, 6)).toEqual([
      base.address,
      '',
      'Hello.',
      '',
      'URI: did:plc:abc123',
    ])
  })

  it('includes expiration time and resources', () => {
    const msg = formatSiweMessage({
      ...base,
      expirationTime: '2026-01-02T00:00:00.000Z',
      resources: ['https://a.example', 'https://b.example'],
    })
    expect(
      msg.endsWith(
        [
          'Expiration Time: 2026-01-02T00:00:00.000Z',
          'Resources:',
          '- https://a.example',
          '- https://b.example',
        ].join('\n'),
      ),
    ).toBe(true)
  })

  it('omits empty resources', () => {
    expect(formatSiweMessage({...base, resources: []})).not.toContain(
      'Resources',
    )
  })
})

describe('formatWalletLinkMessage', () => {
  const args = {address: base.address, chainId: 8453, did: 'did:plc:abc123'}

  it('names the DID as the URI and the wallet address', () => {
    const msg = formatWalletLinkMessage(args)
    expect(msg).toContain('krao.net wants you to sign in')
    expect(msg).toContain(base.address)
    expect(msg).toContain('Link this wallet to my Krao account.')
    expect(msg).toContain('URI: did:plc:abc123')
    expect(msg).toContain('Chain ID: 8453')
  })

  it('uses a fresh hex nonce each time', () => {
    const nonce = (m: string) => /Nonce: (\S+)/.exec(m)![1]
    const a = nonce(formatWalletLinkMessage(args))
    const b = nonce(formatWalletLinkMessage(args))
    expect(a).toMatch(/^[0-9a-f]{24}$/)
    expect(a).not.toBe(b)
  })

  it('stamps an ISO issued-at time', () => {
    const msg = formatWalletLinkMessage(args)
    const issued = /Issued At: (\S+)/.exec(msg)![1]
    expect(new Date(issued).toISOString()).toBe(issued)
  })
})

describe('evmAccountId', () => {
  it('builds a CAIP-10 id', () => {
    expect(evmAccountId(8453, '0xabc')).toBe('eip155:8453:0xabc')
  })
})

describe('shortAddress', () => {
  const address = '0xab16a96d359ec26a11e2c2b3d8f8b8942d5bfcdb'

  it('shortens a long address', () => {
    expect(shortAddress(address)).toBe('0xab16…fcdb')
  })

  it('takes the address part of a CAIP-10 id', () => {
    expect(shortAddress(evmAccountId(8453, address))).toBe('0xab16…fcdb')
  })

  it('leaves short values alone', () => {
    expect(shortAddress('0x1234')).toBe('0x1234')
  })
})
