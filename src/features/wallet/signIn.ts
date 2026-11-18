import {useMutation} from '@tanstack/react-query'

import {useSessionApi} from '#/state/session'
import {createWalletSession, getWalletChallenge} from './api'
import {connectEvmWallet} from './evm'
import {evmAccountId} from './siwe'

/**
 * Sign in with a wallet that is linked to an account on `service`: the PDS
 * issues a one-time message, the wallet signs it, and the PDS returns a
 * session for the account that linked the wallet.
 */
export function useWalletSignInMutation() {
  const {loginWithWalletSession} = useSessionApi()
  return useMutation({
    mutationFn: async ({service}: {service: string}) => {
      const wallet = await connectEvmWallet({fresh: true})
      const account = evmAccountId(wallet.chainId, wallet.address)
      const {message} = await getWalletChallenge(service, account)
      const signature = await wallet.signMessage(message)
      const session = await createWalletSession(service, {
        account,
        message,
        signature,
      })
      await loginWithWalletSession({service, session}, 'LoginForm')
    },
  })
}
