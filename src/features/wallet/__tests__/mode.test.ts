import {describe, expect, it} from '@jest/globals'

import {selectWalletMode} from '../mode'

const none = {isWeb: false, devWallet: false, walletConnectProjectId: ''}

describe('selectWalletMode', () => {
  it('hides wallets on native without a WalletConnect project ID', () => {
    expect(selectWalletMode(none)).toBe('none')
  })

  it('uses WalletConnect on native when a project ID is set', () => {
    expect(selectWalletMode({...none, walletConnectProjectId: 'abc123'})).toBe(
      'walletconnect',
    )
  })

  it('uses the browser wallet on web, whatever the project ID', () => {
    expect(selectWalletMode({...none, isWeb: true})).toBe('injected')
    expect(
      selectWalletMode({...none, isWeb: true, walletConnectProjectId: 'abc'}),
    ).toBe('injected')
  })

  it('prefers the dev wallet everywhere', () => {
    expect(selectWalletMode({...none, devWallet: true})).toBe('dev')
    expect(
      selectWalletMode({
        isWeb: true,
        devWallet: true,
        walletConnectProjectId: 'abc',
      }),
    ).toBe('dev')
    expect(
      selectWalletMode({...none, devWallet: true, walletConnectProjectId: 'a'}),
    ).toBe('dev')
  })
})
