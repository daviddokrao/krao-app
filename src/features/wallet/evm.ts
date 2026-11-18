import {secp256k1} from '@noble/curves/secp256k1'
import {keccak_256} from '@noble/hashes/sha3'
import {bytesToHex, hexToBytes, utf8ToBytes} from '@noble/hashes/utils'

import {KRAO_DEV_RPC_URL} from '#/env'
import {WalletRejectedError, WalletUnavailableError} from './errors'
import {WALLET_MODE} from './mode'
import {type Eip1193Provider} from './walletConnectLinks'

export {WalletRejectedError, WalletUnavailableError}

export type EvmWallet = {
  address: string
  chainId: number
  /** EIP-191 personal_sign over the UTF-8 message, as 0x hex */
  signMessage: (message: string) => Promise<string>
  /** Ask the wallet to switch to `chainId` if it is on another chain */
  switchChain: (chainId: number) => Promise<void>
  /** Send a transaction and resolve with its hash once it is submitted */
  sendTransaction: (tx: {
    to: string
    value?: bigint
    data?: string
  }) => Promise<string>
}

/** Chains Krao uses, to add to wallets that do not know them (EIP-3085) */
const KNOWN_CHAINS: Record<
  number,
  {
    chainName: string
    nativeCurrency: {name: string; symbol: string; decimals: number}
    rpcUrls: string[]
    blockExplorerUrls: string[]
  }
> = {
  8453: {
    chainName: 'Base',
    nativeCurrency: {name: 'Ether', symbol: 'ETH', decimals: 18},
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org'],
  },
}

/**
 * Where the EIP-1193 provider comes from: the browser's injected wallet on
 * web, a wallet app through WalletConnect on native (when a project ID is
 * set). `fresh` asks WalletConnect to pair again, to pick another wallet.
 */
async function getEip1193Provider(
  fresh: boolean,
): Promise<Eip1193Provider | undefined> {
  if (WALLET_MODE === 'injected') {
    return (globalThis as {ethereum?: Eip1193Provider}).ethereum
  }
  if (WALLET_MODE === 'walletconnect') {
    // Loaded on demand so the WalletConnect packages never reach the web bundle
    const {walletConnect} = await import('./walletconnect')
    return walletConnect.getProvider({fresh})
  }
  return undefined
}

/**
 * Connect an EVM wallet: the built-in dev wallet when enabled, otherwise the
 * browser's injected provider (MetaMask, Rabby, Coinbase extension...) or, on
 * native with a WalletConnect project ID, a wallet app on the phone.
 */
export async function connectEvmWallet({
  fresh = false,
}: {
  fresh?: boolean
} = {}): Promise<EvmWallet> {
  if (WALLET_MODE === 'dev') {
    return devWallet()
  }
  const provider = await getEip1193Provider(fresh)
  if (!provider) {
    throw new WalletUnavailableError('No Ethereum wallet found')
  }
  try {
    const accounts = (await provider.request({
      method: 'eth_requestAccounts',
    })) as string[]
    const chainIdHex = (await provider.request({
      method: 'eth_chainId',
    })) as string
    const address = accounts[0]
    if (!address) {
      throw new WalletRejectedError('No account selected')
    }
    const request = async (method: string, params?: unknown[]) => {
      try {
        return await provider.request({method, params})
      } catch (err) {
        if ((err as {code?: number})?.code === 4001) {
          throw new WalletRejectedError('Request rejected in wallet')
        }
        throw err
      }
    }
    return {
      address,
      chainId: parseInt(chainIdHex, 16),
      signMessage: async message =>
        (await request('personal_sign', [
          `0x${bytesToHex(utf8ToBytes(message))}`,
          address,
        ])) as string,
      switchChain: async chainId => {
        const hexId = `0x${chainId.toString(16)}`
        try {
          await request('wallet_switchEthereumChain', [{chainId: hexId}])
        } catch (err) {
          // EIP-3326 code 4902: the wallet does not know the chain yet
          const params = KNOWN_CHAINS[chainId]
          if ((err as {code?: number})?.code !== 4902 || !params) throw err
          await request('wallet_addEthereumChain', [
            {chainId: hexId, ...params},
          ])
          // Adding may not switch (EIP-3085 leaves it to the wallet)
          await request('wallet_switchEthereumChain', [{chainId: hexId}])
        }
        // Never send on another chain than the one asked for
        const current = (await request('eth_chainId')) as string
        if (parseInt(current, 16) !== chainId) {
          throw new WalletRejectedError('The wallet did not switch networks')
        }
      },
      sendTransaction: async ({to, value, data}) =>
        (await request('eth_sendTransaction', [
          {
            from: address,
            to,
            value: value ? `0x${value.toString(16)}` : undefined,
            data,
          },
        ])) as string,
    }
  } catch (err) {
    // EIP-1193 code 4001: the user rejected the request
    if ((err as {code?: number})?.code === 4001) {
      throw new WalletRejectedError('Request rejected in wallet')
    }
    throw err
  }
}

/**
 * Hardhat's well-known account #0. Its key is public, so it must only ever be
 * used against local test networks.
 */
const DEV_PRIVATE_KEY =
  'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const DEV_CHAIN_ID = 8453

function devWallet(): EvmWallet {
  const privateKey = hexToBytes(DEV_PRIVATE_KEY)
  const publicKey = secp256k1.getPublicKey(privateKey, false)
  const address = '0x' + bytesToHex(keccak_256(publicKey.slice(1)).slice(-20))
  return {
    address,
    chainId: DEV_CHAIN_ID,
    switchChain: () => Promise.resolve(),
    // Anvil keeps its default accounts unlocked, so the node signs for us
    sendTransaction: async ({to, value, data}) => {
      const res = await fetch(KRAO_DEV_RPC_URL, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_sendTransaction',
          params: [
            {
              from: address,
              to,
              value: value ? `0x${value.toString(16)}` : undefined,
              data,
            },
          ],
        }),
      })
      const body = (await res.json()) as {
        result?: string
        error?: {message: string}
      }
      if (!body.result) {
        throw new Error(body.error?.message ?? 'Transaction failed')
      }
      return body.result
    },
    signMessage: message => {
      const sig = secp256k1.sign(hashPersonalMessage(message), privateKey)
      return Promise.resolve(
        '0x' +
          bytesToHex(sig.toCompactRawBytes()) +
          (sig.recovery + 27).toString(16),
      )
    },
  }
}

function hashPersonalMessage(message: string): Uint8Array {
  const bytes = utf8ToBytes(message)
  const prefix = utf8ToBytes(`\x19Ethereum Signed Message:\n${bytes.length}`)
  const data = new Uint8Array(prefix.length + bytes.length)
  data.set(prefix)
  data.set(bytes, prefix.length)
  return keccak_256(data)
}
