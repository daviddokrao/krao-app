import {toDatetimeString} from '@atproto/syntax'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {KRAO_INDEXER_URL} from '#/env'
import {getChainProfile} from '#/features/wallet/api'
import {connectEvmWallet} from '#/features/wallet/evm'
import {evmAccountId} from '#/features/wallet/siwe'
import {io} from '#/lexicons'
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
      const url = new URL('/xrpc/io.krao.feed.getTips', KRAO_INDEXER_URL)
      url.searchParams.set('subject', subject!)
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error('Could not load tips')
      return (await res.json()) as {tips: TipView[]; totals: TipTotal[]}
    },
  })
}

/** The recipient's first verified EVM wallet, which tips are sent to */
export function useTipRecipientWallet(did: string) {
  return useQuery({
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createQueryKey('tip-recipient-wallet', {did}),
    queryFn: async () => {
      const profile = await getChainProfile(did)
      const wallet = profile.wallets.find(
        w => w.status === 'verified' && w.account.startsWith('eip155:'),
      )
      return wallet ? (wallet.account.split(':')[2] ?? null) : null
    },
  })
}

/**
 * Send a tip: transfer the asset from the user's wallet to the recipient's
 * linked wallet, then record it as an io.krao.feed.tip so the indexer can
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
      if (wallet.chainId !== TIP_CHAIN_ID) {
        await wallet.switchChain(TIP_CHAIN_ID)
      }
      const txHash = asset.contract
        ? await wallet.sendTransaction({
            to: asset.contract,
            data: erc20TransferData(recipientAddress, amount),
          })
        : await wallet.sendTransaction({to: recipientAddress, value: amount})

      await pdsClient.create(io.krao.feed.tip, {
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
    onSuccess: (_txHash, {subject}) => {
      if (!subject) return
      // The indexer verifies the transaction a moment after the record lands
      for (const delay of [1000, 3000, 8000]) {
        setTimeout(() => {
          void queryClient.invalidateQueries({
            queryKey: createTipsQueryKey(subject.uri),
          })
        }, delay)
      }
    },
  })
}
