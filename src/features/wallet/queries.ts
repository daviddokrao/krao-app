import {AtUri, toDatetimeString} from '@atproto/syntax'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {io} from '#/lexicons'
import {getChainProfile} from './api'
import {connectEvmWallet} from './evm'
import {evmAccountId, formatWalletLinkMessage} from './siwe'

const chainProfileQueryKeyRoot = 'chain-profile'
export const createChainProfileQueryKey = (did: string) =>
  createQueryKey(chainProfileQueryKeyRoot, {did})

/** Linked wallets of an account, as verified by the Krao indexer */
export function useChainProfileQuery(did: string | undefined) {
  return useQuery({
    enabled: !!did,
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createChainProfileQueryKey(did ?? ''),
    queryFn: () => getChainProfile(did!),
  })
}

/*
 * The indexer picks up repo writes from the firehose a moment later, so
 * refetch a few times after a change rather than once.
 */
function useRefetchChainProfile() {
  const queryClient = useQueryClient()
  return (did: string) => {
    for (const delay of [500, 1500, 4000]) {
      setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: createChainProfileQueryKey(did),
        })
      }, delay)
    }
  }
}

/**
 * Connect a wallet, have it sign a message naming the account's DID, and
 * store the signed link as an io.krao.actor.wallet record.
 */
export function useLinkWalletMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const refetch = useRefetchChainProfile()
  return useMutation({
    mutationFn: async ({label}: {label?: string} = {}) => {
      if (!currentAccount) throw new Error('Not signed in')
      const wallet = await connectEvmWallet()
      const message = formatWalletLinkMessage({
        address: wallet.address,
        chainId: wallet.chainId,
        did: currentAccount.did,
      })
      const signature = await wallet.signMessage(message)
      return pdsClient.create(io.krao.actor.wallet, {
        account: evmAccountId(wallet.chainId, wallet.address),
        proof: {type: 'siwe', message, signature},
        label,
        createdAt: toDatetimeString(new Date()),
      })
    },
    onSuccess: () => {
      if (currentAccount) refetch(currentAccount.did)
    },
  })
}

export function useUnlinkWalletMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const refetch = useRefetchChainProfile()
  return useMutation({
    mutationFn: async ({uri}: {uri: string}) => {
      if (!currentAccount) throw new Error('Not signed in')
      await pdsClient.delete(io.krao.actor.wallet, {
        repo: currentAccount.did,
        rkey: new AtUri(uri).rkey,
      })
    },
    onSuccess: () => {
      if (currentAccount) refetch(currentAccount.did)
    },
  })
}
