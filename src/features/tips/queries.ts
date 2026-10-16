import {TID} from '@atproto/common-web'
import {toDatetimeString} from '@atproto/syntax'
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {createBatchLoader} from '#/lib/batchLoader'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {KRAO_INDEXER_URL} from '#/env'
import {TOP_SUPPORTERS_KEY} from '#/features/creator/queries'
import {getChainProfile} from '#/features/wallet/api'
import {connectEvmWallet} from '#/features/wallet/evm'
import {createChainProfileQueryKey} from '#/features/wallet/queries'
import {evmAccountId} from '#/features/wallet/siwe'
import {net} from '#/lexicons'
import {erc20TransferData, TIP_CHAIN_ID, type TipAsset} from './assets'
import {
  type PendingTipRecord,
  pendingTipsFor,
  removePendingTip,
  savePendingTip,
} from './pendingTips'

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
    enabled: !!did,
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

/** The transfer went through but its record could not be written yet */
export class TipNotRecordedError extends Error {}

/**
 * Send `amount` of `asset` from the connected wallet to `to` on Base. The
 * indexer only credits payments sent from one of the sender's verified
 * wallets, so this checks before any money moves. Shared by tips and
 * memberships.
 */
export async function transferFromLinkedWallet({
  queryClient,
  did,
  asset,
  to,
  amount,
}: {
  queryClient: QueryClient
  did: string
  asset: TipAsset
  to: string
  amount: bigint
}): Promise<{txHash: string; walletAddress: string}> {
  const wallet = await connectEvmWallet()
  const me = await queryClient.fetchQuery({
    queryKey: createChainProfileQueryKey(did),
    queryFn: () => getChainProfile(did),
    staleTime: STALE.SECONDS.THIRTY,
  })
  const linked = me.wallets.some(
    w =>
      w.status === 'verified' &&
      w.account.startsWith('eip155:') &&
      w.account.split(':')[2]?.toLowerCase() === wallet.address.toLowerCase(),
  )
  if (!linked) throw new UnlinkedTipWalletError()
  if (wallet.chainId !== TIP_CHAIN_ID) {
    await wallet.switchChain(TIP_CHAIN_ID)
  }
  const txHash = asset.contract
    ? await wallet.sendTransaction({
        to: asset.contract,
        data: erc20TransferData(to, amount),
      })
    : await wallet.sendTransaction({to, value: amount})
  return {txHash, walletAddress: wallet.address}
}

const RECORD_RETRY_DELAYS_MS = [0, 1000, 3000]

/**
 * Write a tip record kept by savePendingTip. A put at the rkey chosen when
 * it was saved, so writing it twice (a lost response, a retry) leaves one
 * record.
 */
async function writePendingTip(
  pdsClient: ReturnType<typeof usePdsClient>,
  did: string,
  rkey: string,
  record: PendingTipRecord,
) {
  await pdsClient.put(net.krao.feed.tip, record as never, {
    repo: did as `did:${string}:${string}`,
    rkey,
  })
  removePendingTip(record.txHash)
}

/**
 * Save the records of tips that were paid but not recorded. Never moves
 * money: this is what to offer after TipNotRecordedError, instead of sending
 * again.
 */
export function useSavePendingTipsMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  return useMutation({
    mutationFn: async () => {
      if (!currentAccount) throw new Error('Not signed in')
      for (const {rkey, record} of pendingTipsFor(currentAccount.did)) {
        await writePendingTip(pdsClient, currentAccount.did, rkey, record)
      }
    },
  })
}

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
      anonymous,
    }: {
      recipientDid: string
      recipientAddress: string
      subject?: {uri: string; cid: string}
      asset: TipAsset
      amount: bigint
      message?: string
      /** Hide the tipper's name in the recipient's top supporters */
      anonymous?: boolean
    }) => {
      if (!currentAccount) throw new Error('Not signed in')
      const writeTip = (rkey: string, record: PendingTipRecord) =>
        writePendingTip(pdsClient, currentAccount.did, rkey, record)
      // Tips paid earlier whose record failed to save
      for (const {rkey, record} of pendingTipsFor(currentAccount.did)) {
        await writeTip(rkey, record).catch(() => {})
      }
      const {txHash, walletAddress} = await transferFromLinkedWallet({
        queryClient,
        did: currentAccount.did,
        asset,
        to: recipientAddress,
        amount,
      })

      const record: PendingTipRecord = {
        recipient: recipientDid as `did:${string}:${string}`,
        subject,
        asset: asset.id,
        amount: amount.toString(),
        txHash,
        from: evmAccountId(TIP_CHAIN_ID, walletAddress),
        to: evmAccountId(TIP_CHAIN_ID, recipientAddress),
        message: message || undefined,
        anonymous: anonymous || undefined,
        createdAt: toDatetimeString(new Date()),
      }
      // The money has moved: keep the record until it is written
      const rkey = TID.nextStr()
      savePendingTip(currentAccount.did, rkey, record)
      for (const [i, delay] of RECORD_RETRY_DELAYS_MS.entries()) {
        await new Promise(resolve => setTimeout(resolve, delay))
        try {
          await writeTip(rkey, record)
          return txHash
        } catch (err) {
          if (i === RECORD_RETRY_DELAYS_MS.length - 1) {
            throw new TipNotRecordedError(String(err))
          }
        }
      }
      return txHash
    },
    onSuccess: (_txHash, {subject, recipientDid}) => {
      /*
       * The indexer verifies the transaction a moment after the record lands,
       * which updates the post's tips and both accounts' tip badges.
       */
      const queryKeys = [
        createChainProfileQueryKey(recipientDid),
        [TOP_SUPPORTERS_KEY],
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
