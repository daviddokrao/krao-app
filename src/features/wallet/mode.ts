import {IS_WEB, KRAO_DEV_WALLET, WALLETCONNECT_PROJECT_ID} from '#/env'

/**
 * Where wallet connections come from:
 * - `dev`: the built-in test wallet (local development only)
 * - `injected`: the browser's own wallet (MetaMask, Rabby...), on web
 * - `walletconnect`: a wallet app on the phone, on native with a project ID
 * - `none`: native without a project ID, where wallet features stay hidden
 */
export type WalletMode = 'dev' | 'injected' | 'walletconnect' | 'none'

export function selectWalletMode({
  isWeb,
  devWallet,
  walletConnectProjectId,
}: {
  isWeb: boolean
  devWallet: boolean
  walletConnectProjectId: string
}): WalletMode {
  if (devWallet) return 'dev'
  if (isWeb) return 'injected'
  return walletConnectProjectId ? 'walletconnect' : 'none'
}

export const WALLET_MODE: WalletMode = selectWalletMode({
  isWeb: IS_WEB,
  devWallet: KRAO_DEV_WALLET,
  walletConnectProjectId: WALLETCONNECT_PROJECT_ID,
})

/** Whether this build can connect a wallet to link, tip or open a gate */
export const CAN_CONNECT_WALLET: boolean = WALLET_MODE !== 'none'
