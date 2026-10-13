import {secp256k1} from '@noble/curves/secp256k1'
import {keccak_256} from '@noble/hashes/sha3'
import {bytesToHex, hexToBytes, utf8ToBytes} from '@noble/hashes/utils'

import {IS_WEB, KRAO_DEV_WALLET} from '#/env'

export type EvmWallet = {
  address: string
  chainId: number
  /** EIP-191 personal_sign over the UTF-8 message, as 0x hex */
  signMessage: (message: string) => Promise<string>
}

export class WalletUnavailableError extends Error {}
export class WalletRejectedError extends Error {}

type Eip1193Provider = {
  request: (args: {method: string; params?: unknown[]}) => Promise<unknown>
}

/**
 * Connect an EVM wallet: the built-in dev wallet when enabled, otherwise the
 * browser's injected provider (MetaMask, Rabby, Coinbase extension...).
 * Native apps need WalletConnect, which is not wired up yet.
 */
export async function connectEvmWallet(): Promise<EvmWallet> {
  if (KRAO_DEV_WALLET) {
    return devWallet()
  }
  const provider = IS_WEB
    ? (globalThis as {ethereum?: Eip1193Provider}).ethereum
    : undefined
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
    return {
      address,
      chainId: parseInt(chainIdHex, 16),
      signMessage: async message =>
        (await provider.request({
          method: 'personal_sign',
          params: [`0x${bytesToHex(utf8ToBytes(message))}`, address],
        })) as string,
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
