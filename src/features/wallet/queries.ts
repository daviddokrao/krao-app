import {TID} from '@atproto/common-web'
import {type $Typed} from '@atproto/lex'
import {AtUri, toDatetimeString} from '@atproto/syntax'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {com, io} from '#/lexicons'
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

/** EVM addresses are case-insensitive; other chains' ids are not */
function isSameAccount(a: string, b: string) {
  return a.startsWith('eip155:') && b.startsWith('eip155:')
    ? a.toLowerCase() === b.toLowerCase()
    : a === b
}

/** URIs of the user's io.krao.actor.wallet records for one wallet */
async function listWalletRecordUris(
  pdsClient: ReturnType<typeof usePdsClient>,
  did: string,
  account: string,
) {
  const uris: string[] = []
  let cursor: string | undefined
  // Accounts hold a handful of wallet links, so this rarely pages
  for (let i = 0; i < 10; i++) {
    const res = await pdsClient.list(io.krao.actor.wallet, {
      repo: did as `did:${string}:${string}`,
      cursor,
      limit: 100,
    })
    for (const record of res.records) {
      // Unvalidated: malformed links can't match and are left alone
      const linked = record.value.account
      if (typeof linked === 'string' && isSameAccount(linked, account)) {
        uris.push(record.uri)
      }
    }
    cursor = res.cursor
    if (!cursor) break
  }
  return uris
}

function deleteWrite(uri: string): $Typed<com.atproto.repo.applyWrites.Delete> {
  return {
    $type: 'com.atproto.repo.applyWrites#delete',
    collection: 'io.krao.actor.wallet',
    rkey: new AtUri(uri).rkey,
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
      const account = evmAccountId(wallet.chainId, wallet.address)
      const record: io.krao.actor.wallet.Main = {
        $type: 'io.krao.actor.wallet',
        account,
        proof: {type: 'siwe', message, signature},
        label,
        createdAt: toDatetimeString(new Date()),
      }
      // Relinking replaces the old link instead of adding a duplicate
      const existing = await listWalletRecordUris(
        pdsClient,
        currentAccount.did,
        account,
      )
      await pdsClient.call(com.atproto.repo.applyWrites, {
        repo: currentAccount.did,
        writes: [
          ...existing.map(deleteWrite),
          {
            $type: 'com.atproto.repo.applyWrites#create',
            collection: 'io.krao.actor.wallet',
            rkey: TID.nextStr(),
            value: record,
          },
        ],
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
    mutationFn: async ({account}: {account: string}) => {
      if (!currentAccount) throw new Error('Not signed in')
      /*
       * The wallet may be linked by several records (eg linked twice), and
       * any one of them keeps it linked, so remove them all.
       */
      const uris = await listWalletRecordUris(
        pdsClient,
        currentAccount.did,
        account,
      )
      if (!uris.length) return
      await pdsClient.call(com.atproto.repo.applyWrites, {
        repo: currentAccount.did,
        writes: uris.map(deleteWrite),
      })
    },
    onSuccess: () => {
      if (currentAccount) refetch(currentAccount.did)
    },
  })
}
