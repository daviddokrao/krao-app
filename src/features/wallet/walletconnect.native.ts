import '@walletconnect/react-native-compat'

import {Linking} from 'react-native'
import {type EthereumProvider} from '@walletconnect/ethereum-provider'

import {KRAO_WEB_URL, WALLETCONNECT_PROJECT_ID} from '#/env'
import {WalletRejectedError, WalletUnavailableError} from './errors'
import {
  type Eip1193Provider,
  isUserRejection,
  needsWalletApproval,
  WALLET_REDIRECT_NATIVE,
  type WalletConnectApi,
  walletOpenLink,
  walletPairingLinks,
} from './walletConnectLinks'

/*
 * WalletConnect v2 for the mobile apps: the app is the dapp, a wallet app on
 * the phone holds the keys. We use the headless EthereumProvider (no QR modal
 * package) and open the wallet app ourselves with a deep link. Only loaded
 * when EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID is set.
 */

type WcProvider = InstanceType<typeof EthereumProvider>

/** Base mainnet: the chain tips and gates run on */
const REQUIRED_CHAIN = 8453
/** How long to wait for the user to approve the pairing in the wallet app */
const CONNECT_TIMEOUT_MS = 2 * 60 * 1000
/** Gives the request time to reach the relay before the app goes to background */
const OPEN_WALLET_DELAY_MS = 400

let providerPromise: Promise<WcProvider> | undefined

function getWcProvider(): Promise<WcProvider> {
  providerPromise ??= (async () => {
    const {EthereumProvider} = await import('@walletconnect/ethereum-provider')
    return EthereumProvider.init({
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [REQUIRED_CHAIN],
      showQrModal: false,
      metadata: {
        name: 'Krao',
        description: 'Krao Network',
        url: KRAO_WEB_URL,
        icons: [`${KRAO_WEB_URL.replace(/\/$/, '')}/apple-touch-icon.png`],
        redirect: {native: WALLET_REDIRECT_NATIVE, universal: KRAO_WEB_URL},
      },
    })
  })().catch(err => {
    providerPromise = undefined
    throw err
  })
  return providerPromise
}

async function openFirst(links: string[]): Promise<boolean> {
  for (const link of links) {
    try {
      await Linking.openURL(link)
      return true
    } catch {
      // not installed, try the next wallet
    }
  }
  return false
}

async function pair(provider: WcProvider) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let onUri: (uri: string) => void = () => {}
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new WalletRejectedError('Wallet did not respond')),
      CONNECT_TIMEOUT_MS,
    )
  })
  // No wallet app took the link: stop waiting for an approval that cannot come
  const noWallet = new Promise<never>((_, reject) => {
    onUri = uri => {
      void openFirst(walletPairingLinks(uri)).then(opened => {
        if (!opened) reject(new WalletUnavailableError('No wallet app found'))
      })
    }
  })
  provider.on('display_uri', onUri)
  try {
    await Promise.race([provider.connect(), timeout, noWallet])
  } finally {
    clearTimeout(timer)
    provider.off('display_uri', onUri)
  }
}

async function ensureConnected(fresh: boolean): Promise<WcProvider> {
  const provider = await getWcProvider()
  if (fresh && provider.session) {
    await provider.disconnect().catch(() => {})
  }
  if (!provider.session || provider.accounts.length === 0) {
    try {
      await pair(provider)
    } catch (err) {
      if (err instanceof WalletUnavailableError) throw err
      if (err instanceof WalletRejectedError) throw err
      if (isUserRejection(err)) {
        throw new WalletRejectedError('Request rejected in wallet')
      }
      throw err
    }
  }
  return provider
}

function openConnectedWallet(provider: WcProvider) {
  const link = walletOpenLink(provider.session?.peer.metadata.redirect)
  if (!link) return
  setTimeout(() => {
    Linking.openURL(link).catch(() => {})
  }, OPEN_WALLET_DELAY_MS)
}

export const walletConnect: WalletConnectApi = {
  async getProvider({fresh = false} = {}): Promise<Eip1193Provider> {
    const provider = await ensureConnected(fresh)
    return {
      request: async ({method, params}) => {
        if (method === 'eth_requestAccounts') return provider.accounts
        if (method === 'eth_chainId') {
          return `0x${provider.chainId.toString(16)}`
        }
        try {
          const result = provider.request({
            method,
            params,
          })
          if (needsWalletApproval(method)) openConnectedWallet(provider)
          return await result
        } catch (err) {
          // evm.ts maps EIP-1193 code 4001 to "cancelled in your wallet"
          if (isUserRejection(err))
            throw Object.assign(new Error('Rejected'), {code: 4001})
          throw err
        }
      },
    }
  },
}
