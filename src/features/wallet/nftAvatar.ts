import {toDatetimeString} from '@atproto/syntax'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {
  useProfileQuery,
  useProfileUpdateMutation,
} from '#/state/queries/profile'
import {usePdsClient, useSession} from '#/state/session'
import {net} from '#/lexicons'
import {nftImageUrl, type NftRef} from './api'
import {createChainProfileQueryKey} from './queries'

/**
 * Use an NFT held by one of the user's linked wallets as their profile
 * picture: the image (rendered to PNG by the indexer) becomes the regular
 * app.bsky avatar, so every Bluesky client shows it, and an
 * net.krao.actor.nftAvatar record lets Krao verify and badge it.
 */
export function useSetNftAvatarMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  const {data: profile} = useProfileQuery({did: currentAccount?.did})
  const {mutateAsync: updateProfile} = useProfileUpdateMutation()

  return useMutation({
    mutationFn: async ({nft, wallet}: {nft: NftRef; wallet: string}) => {
      if (!currentAccount || !profile) throw new Error('Not signed in')
      const res = await fetch(nftImageUrl(nft))
      if (!res.ok) throw new Error('Could not load the NFT image')
      const objectUrl = URL.createObjectURL(await res.blob())
      try {
        await updateProfile({
          profile,
          updates: existing => existing,
          newUserAvatar: {
            path: objectUrl,
            mime: 'image/png',
            width: 512,
            height: 512,
          },
        })
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
      await pdsClient.put(
        net.krao.actor.nftAvatar,
        {
          nft: {
            chain: nft.chain,
            contract: nft.contract,
            tokenId: nft.tokenId,
            standard: nft.standard,
          },
          wallet,
          createdAt: toDatetimeString(new Date()),
        },
        {repo: currentAccount.did, rkey: 'self'},
      )
    },
    onSuccess: () => {
      if (!currentAccount) return
      for (const delay of [500, 2000, 5000]) {
        setTimeout(() => {
          void queryClient.invalidateQueries({
            queryKey: createChainProfileQueryKey(currentAccount.did),
          })
        }, delay)
      }
    },
  })
}

/** Stop marking the avatar as an NFT. The profile picture itself is kept. */
export function useRemoveNftAvatarMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!currentAccount) throw new Error('Not signed in')
      await pdsClient.delete(net.krao.actor.nftAvatar, {
        repo: currentAccount.did,
        rkey: 'self',
      })
    },
    onSuccess: () => {
      if (!currentAccount) return
      setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: createChainProfileQueryKey(currentAccount.did),
        })
      }, 1500)
    },
  })
}
