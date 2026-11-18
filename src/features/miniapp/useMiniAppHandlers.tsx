import {useRef} from 'react'
import {useLingui} from '@lingui/react/macro'
import {useQueryClient} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {useProfileQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {IS_ANDROID, IS_WEB} from '#/env'
import {TIP_CHAIN_ID} from '#/features/tips/assets'
import {getChainProfile} from '#/features/wallet/api'
import {
  connectEvmWallet,
  WalletRejectedError,
  WalletUnavailableError,
} from '#/features/wallet/evm'
import {CAN_CONNECT_WALLET} from '#/features/wallet/mode'
import {createChainProfileQueryKey} from '#/features/wallet/queries'
import {BridgeError, type Handlers} from './bridge'
import {useHostDialog} from './components/HostDialog'
import {MINIAPP_CHAIN, type MiniAppPlatform, type MiniAppView} from './logic'

/**
 * What a running Mini App can ask the host to do. Each method that touches
 * the wallet asks the user: nothing is signed or sent without the preview,
 * and the wallet itself still asks after that. `app` is the record the
 * indexer approved; `onClose` ends the run.
 */
export function useMiniAppHandlers({
  app,
  origin,
  onClose,
}: {
  app: MiniAppView
  /** Origin of the manifest, from manifestOrigin() */
  origin: string
  onClose: () => void
}) {
  const {i18n} = useLingui()
  const {currentAccount} = useSession()
  const {data: profile} = useProfileQuery({did: currentAccount?.did})
  const queryClient = useQueryClient()
  const dialog = useHostDialog()
  // The address the user shared in this run; signing is only for this one
  const shared = useRef<string>(undefined)

  const requireWallet = () => {
    if (!CAN_CONNECT_WALLET) {
      throw new BridgeError('Unsupported', 'No wallet on this device')
    }
    if (!shared.current) {
      throw new BridgeError('Failed', 'Call requestWallet first')
    }
    return shared.current
  }

  /** The wallet the user shared, connected: anything else is refused */
  const connectShared = async (address: string) => {
    try {
      const wallet = await connectEvmWallet()
      if (wallet.address.toLowerCase() !== address.toLowerCase()) {
        throw new BridgeError(
          'Failed',
          'The connected wallet is not the one you shared',
        )
      }
      return wallet
    } catch (err) {
      throw mapWalletError(err)
    }
  }

  const handlers: Handlers = {
    getContext: () => {
      if (!currentAccount) {
        return Promise.reject(new BridgeError('Failed', 'Not signed in'))
      }
      const platform: MiniAppPlatform = IS_WEB
        ? 'web'
        : IS_ANDROID
          ? 'android'
          : 'ios'
      return Promise.resolve({
        user: {
          did: currentAccount.did,
          handle: currentAccount.handle,
          ...(profile?.displayName ? {displayName: profile.displayName} : {}),
        },
        app: {uri: app.uri},
        platform,
        locale: i18n.locale,
      })
    },

    requestWallet: async () => {
      if (!CAN_CONNECT_WALLET) {
        throw new BridgeError('Unsupported', 'No wallet on this device')
      }
      if (!currentAccount) throw new BridgeError('Failed', 'Not signed in')
      const chain = await queryClient.fetchQuery({
        queryKey: createChainProfileQueryKey(currentAccount.did),
        queryFn: () => getChainProfile(currentAccount.did),
        staleTime: STALE.SECONDS.THIRTY,
      })
      const addresses = chain.wallets
        .filter(w => w.status === 'verified' && w.account.startsWith('eip155:'))
        .map(w => w.account.split(':')[2])
        .filter((a): a is string => !!a)
      if (addresses.length === 0) {
        throw new BridgeError('Failed', 'No wallet is linked to this account')
      }
      const address = await dialog.askWallet(app.name, addresses)
      if (!address) throw new BridgeError('UserRejected')
      shared.current = address
      return {address, chain: MINIAPP_CHAIN}
    },

    signMessage: async ({message}) => {
      const address = requireWallet()
      const accepted = await dialog.askApproval({
        kind: 'signature',
        chain: MINIAPP_CHAIN,
        from: address,
        method: 'personal_sign',
        payload: message,
        origin,
      })
      if (!accepted) throw new BridgeError('UserRejected')
      const wallet = await connectShared(address)
      try {
        return {signature: await wallet.signMessage(message)}
      } catch (err) {
        throw mapWalletError(err)
      }
    },

    sendTransaction: async ({to, data, value}) => {
      const address = requireWallet()
      const accepted = await dialog.askApproval({
        kind: 'transaction',
        chain: MINIAPP_CHAIN,
        from: address,
        to,
        data,
        value,
        origin,
      })
      if (!accepted) throw new BridgeError('UserRejected')
      const wallet = await connectShared(address)
      try {
        if (wallet.chainId !== TIP_CHAIN_ID) {
          await wallet.switchChain(TIP_CHAIN_ID)
        }
        const hash = await wallet.sendTransaction({
          to,
          data,
          value: value ? BigInt(value) : undefined,
        })
        return {hash}
      } catch (err) {
        throw mapWalletError(err)
      }
    },

    close: onClose,
  }

  return {handlers, dialog: dialog.element}
}

/** Wallet failures as the codes the SDK defines; never the raw error text */
function mapWalletError(err: unknown): BridgeError {
  if (err instanceof BridgeError) return err
  if (err instanceof WalletRejectedError) return new BridgeError('UserRejected')
  if (err instanceof WalletUnavailableError) {
    return new BridgeError('Failed', 'No wallet was found')
  }
  return new BridgeError('Failed')
}
