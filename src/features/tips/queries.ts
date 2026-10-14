import {toDatetimeString} from '@atproto/syntax'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {createBatchLoader} from '#/lib/batchLoader'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {KRAO_INDEXER_URL} from '#/env'
import {getChainProfile} from '#/features/wallet/api'
import {connectEvmWallet} from '#/features/wallet/evm'
import {createChainProfileQueryKey} from '#/features/wallet/queries'
import {evmAccountId} from '#/features/wallet/siwe'
import {net} from '#/lexicons'
import {erc20TransferData, TIP_CHAIN_ID, type TipAsset} from './assets'

export type TipView = {
  uri: string
  sender: {did: string; handle: string; displayName?: string; avatar?: string}
  recipient: string
  subject?: string
  asset: string
  amount: string
  txHash: string
  message?: string
  status: 'pending' | 'verified' | 'invalid'
  createdAt: string
}

export type TipTotal = {asset: string; amount: string; count: number}

const tipsQueryKeyRoot = 'tips'
const createTipsQueryKey = (subject: string) =>
  createQueryKey(tipsQueryKeyRoot, {subject})

/** Tips on a post, with verified totals per asset */
export function useTipsQuery(subject: string | undefined) {
  return useQuery({
    enabled: !!subject,
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createTipsQueryKey(subject ?? ''),
    queryFn: async () => {
      const url = new URL('/xrpc/net.krao.feed.getTips', KRAO_INDEXER_URL)
      url.searchParams.set('subject', subject!)
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error('Could not load tips')
      return (await res.json()) as {tips: TipView[]; totals: TipTotal[]}
    },
  })
}

const loadTipTotals = createBatchLoader<string, TipTotal[]>({
  maxBatchSize: 25,
  load: async subjects => {
    const url = new URL('/xrpc/net.krao.feed.getTipTotals', KRAO_INDEXER_URL)
    for (const subject of subjects) url.searchParams.append('subjects', subject)
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error('Could not load tip totals')
    const data = (await res.json()) as {
      subjects: {subject: string; totals: TipTotal[]}[]
    }
    return new Map(data.subjects.map(s => [s.subject, s.totals]))
  },
})

const createTipTotalsQueryKey = (subject: string) =>
  createQueryKey('tip-totals', {subject})

/**
 * Verified tip totals of a post, for feeds. Posts rendered together share
 * one request.
 */
export function useTipTotalsQuery(subject: string) {
  return useQuery({
    staleTime: STALE.MINUTES.ONE,
    queryKey: createTipTotalsQueryKey(subject),
    queryFn: async () => (await loadTipTotals(subject)) ?? [],
  })
}

/**
 * The recipient's first verified EVM wallet, which tips are sent to. Shares
 * the chain profile cache, which the profile header already loads.
 */
export function useTipRecipientWallet(did: string) {
  return useQuery({
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createChainProfileQueryKey(did),
    queryFn: () => getChainProfile(did),
    select: profile => {
      const wallet = profile.wallets.find(
        w => w.status === 'verified' && w.account.startsWith('eip155:'),
      )
      return wallet ? (wallet.account.split(':')[2] ?? null) : null
    },
  })
}

/** The connected wallet is not one of the account's verified wallets */
export class UnlinkedTipWalletError extends Error {}

/**
 * Send a tip: transfer the asset from the user's wallet to the recipient's
 * linked wallet, then record it as an net.krao.feed.tip so the indexer can
 * verify the transaction and count it.
 */
export function useSendTipMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      recipientDid,
      recipientAddress,
      subject,
      asset,
      amount,
      message,
    }: {
      recipientDid: string
      recipientAddress: string
      subject?: {uri: string; cid: string}
      asset: TipAsset
      amount: bigint
      message?: string
    }) => {
      if (!currentAccount) throw new Error('Not signed in')
      const wallet = await connectEvmWallet()
      /*
       * The indexer only credits tips sent from one of the tipper's verified
       * wallets, so check before any money moves
       */
      const me = await queryClient.fetchQuery({
        queryKey: createChainProfileQueryKey(currentAccount.did),
        queryFn: () => getChainProfile(currentAccount.did),
        staleTime: STALE.SECONDS.THIRTY,
      })
      const linked = me.wallets.some(
        w =>
          w.status === 'verified' &&
          w.account.startsWith('eip155:') &&
          w.account.split(':')[2]?.toLowerCase() ===
            wallet.address.toLowerCase(),
      )
      if (!linked) throw new UnlinkedTipWalletError()
      if (wallet.chainId !== TIP_CHAIN_ID) {
        await wallet.switchChain(TIP_CHAIN_ID)
      }
      const txHash = asset.contract
        ? await wallet.sendTransaction({
            to: asset.contract,
            data: erc20TransferData(recipientAddress, amount),
          })
        : await wallet.sendTransaction({to: recipientAddress, value: amount})

      await pdsClient.create(net.krao.feed.tip, {
        recipient: recipientDid as `did:${string}:${string}`,
        subject: subject as never,
        asset: asset.id,
        amount: amount.toString(),
        txHash,
        from: evmAccountId(TIP_CHAIN_ID, wallet.address),
        to: evmAccountId(TIP_CHAIN_ID, recipientAddress),
        message: message || undefined,
        createdAt: toDatetimeString(new Date()),
      })
      return txHash
    },
    onSuccess: (_txHash, {subject, recipientDid}) => {
      /*
       * The indexer verifies the transaction a moment after the record lands,
       * which updates the post's tips and both accounts' tip badges.
       */
      const queryKeys = [
        createChainProfileQueryKey(recipientDid),
        ...(currentAccount
          ? [createChainProfileQueryKey(currentAccount.did)]
          : []),
        ...(subject
          ? [
              createTipsQueryKey(subject.uri),
              createTipTotalsQueryKey(subject.uri),
            ]
          : []),
      ]
      for (const delay of [1000, 3000, 8000]) {
        setTimeout(() => {
          for (const queryKey of queryKeys) {
            void queryClient.invalidateQueries({queryKey})
          }
        }, delay)
      }
    },
  })
}
