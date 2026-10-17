import {type WalletConnectApi} from './walletConnectLinks'

/*
 * Web (and anything without native modules): wallets come from the browser,
 * so WalletConnect is never used and its packages stay out of the web bundle.
 * The native implementation is in walletconnect.native.ts.
 */
export const walletConnect: WalletConnectApi = {
  getProvider: () => Promise.reject(new Error('WalletConnect is native-only')),
}
