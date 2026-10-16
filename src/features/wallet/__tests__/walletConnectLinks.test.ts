import {describe, expect, it} from '@jest/globals'

import {
  isUserRejection,
  needsWalletApproval,
  WALLET_REDIRECT_NATIVE,
  walletOpenLink,
  walletPairingLinks,
} from '../walletConnectLinks'

describe('walletPairingLinks', () => {
  const uri = 'wc:abc@2?relay-protocol=irn&symKey=k&x=a b'
  const links = walletPairingLinks(uri)

  it('encodes the pairing URI for wallet deep links', () => {
    expect(links[0]).toBe(`metamask://wc?uri=${encodeURIComponent(uri)}`)
    for (const link of links.slice(0, -1)) {
      expect(link).toContain(encodeURIComponent(uri))
    }
  })

  it('ends with the bare wc: link', () => {
    expect(links.at(-1)).toBe(uri)
  })
})

describe('wallet redirect', () => {
  it('is an inert intent link the app scheme ignores', () => {
    expect(WALLET_REDIRECT_NATIVE).toBe('krao://intent/wallet')
  })
})

describe('needsWalletApproval', () => {
  it('is true for methods the user approves in the wallet', () => {
    expect(needsWalletApproval('personal_sign')).toBe(true)
    expect(needsWalletApproval('eth_sendTransaction')).toBe(true)
    expect(needsWalletApproval('wallet_switchEthereumChain')).toBe(true)
  })

  it('is false for reads', () => {
    expect(needsWalletApproval('eth_chainId')).toBe(false)
    expect(needsWalletApproval('eth_accounts')).toBe(false)
  })
})

describe('walletOpenLink', () => {
  it('prefers the native link', () => {
    expect(
      walletOpenLink({native: 'metamask://', universal: 'https://m.app'}),
    ).toBe('metamask://')
  })

  it('falls back to an https universal link', () => {
    expect(walletOpenLink({universal: 'https://link.example/wc'})).toBe(
      'https://link.example/wc',
    )
    expect(walletOpenLink({native: '', universal: 'https://a.b'})).toBe(
      'https://a.b',
    )
  })

  it('never opens script, data or plain http links named by the peer', () => {
    expect(walletOpenLink({native: 'javascript:alert(1)'})).toBeUndefined()
    expect(walletOpenLink({native: 'data:text/html,hi'})).toBeUndefined()
    expect(walletOpenLink({native: 'http://insecure.example'})).toBeUndefined()
    expect(walletOpenLink({native: 'file:///etc/passwd'})).toBeUndefined()
  })

  it('never opens our own deep links or dialer/messaging handlers', () => {
    expect(
      walletOpenLink({native: 'krao://intent/compose?text=hi'}),
    ).toBeUndefined()
    expect(walletOpenLink({native: 'KRAO://profile/x'})).toBeUndefined()
    expect(walletOpenLink({native: 'tel://123'})).toBeUndefined()
    expect(walletOpenLink({native: 'sms://123'})).toBeUndefined()
    expect(
      walletOpenLink({native: 'tel://1', universal: 'https://w.example'}),
    ).toBe('https://w.example')
  })

  it('returns nothing without redirect metadata', () => {
    expect(walletOpenLink(undefined)).toBeUndefined()
    expect(walletOpenLink(null)).toBeUndefined()
    expect(walletOpenLink({})).toBeUndefined()
  })
})

describe('isUserRejection', () => {
  it('recognises EIP-1193 and WalletConnect rejection codes', () => {
    expect(isUserRejection({code: 4001})).toBe(true)
    expect(isUserRejection({code: 5000})).toBe(true)
  })

  it('recognises a rejection message', () => {
    expect(isUserRejection(new Error('User rejected the request.'))).toBe(true)
    expect(isUserRejection(new Error('User denied transaction'))).toBe(true)
  })

  it('does not treat other errors as a rejection', () => {
    expect(isUserRejection(new Error('network down'))).toBe(false)
    expect(isUserRejection({code: -32603})).toBe(false)
    expect(isUserRejection(undefined)).toBe(false)
  })
})
