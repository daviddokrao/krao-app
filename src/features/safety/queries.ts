import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {createBatchLoader} from '#/lib/batchLoader'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useSession} from '#/state/session'
import {net} from '#/lexicons'
import {rewardsFetch} from '../referral/api'
import {useRewardsAuth, useRewardsQuery} from '../referral/queries'
import {extractEvmAddresses, getAddressSafety} from './addresses'
import {checkAddressesRequest, getBadgesRequest} from './api'
import {getCachedLinkSafety, getLinkSafety, isCheckableLink} from './links'

/** Whether a web link is on Krao's list of scam sites (`undefined`: unknown) */
export function useLinkSafetyQuery(url: string | undefined) {
  return useQuery({
    enabled: !!url && isCheckableLink(url),
    staleTime: STALE.MINUTES.FIVE,
    queryKey: createQueryKey('link-safety', {url: url ?? ''}),
    initialData: () => (url ? getCachedLinkSafety(url) : undefined),
    queryFn: async () => (await getLinkSafety(url!)) ?? null,
  })
}

/**
 * Addresses in `text` that look like a wallet verified by another account:
 * the lookalike, and whose wallet it resembles.
 */
export function useAddressLookalikes(text: string | undefined) {
  const addresses = text ? extractEvmAddresses(text) : []
  return useQuery({
    enabled: addresses.length > 0,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: createQueryKey('address-lookalikes', {
      addresses: addresses.join(','),
    }),
    queryFn: async () => {
      const results = await Promise.all(addresses.map(getAddressSafety))
      return results.flatMap(result =>
        result?.lookalikes.length
          ? [{address: result.address, did: result.lookalikes[0].did}]
          : [],
      )
    },
  })
}

/**
 * Who owns an address, and what resembles it, with the account the viewer
 * expects it to belong to (a tip recipient). Not batched with others.
 */
export function useExpectedAddressQuery(
  address: string | undefined,
  expectedDid: string,
) {
  return useQuery({
    enabled: !!address,
    staleTime: STALE.MINUTES.ONE,
    queryKey: createQueryKey('address-expected', {
      address: address?.toLowerCase() ?? '',
      expectedDid,
    }),
    queryFn: async () =>
      (await checkAddressesRequest([address!], expectedDid))[0] ?? null,
  })
}

const loadBadges = createBatchLoader<string, string[]>({
  maxBatchSize: 50,
  load: async dids => {
    const actors = await getBadgesRequest(dids)
    const byDid = new Map(actors.map(actor => [actor.did, actor.badges]))
    // Accounts with no badge are left out of the answer
    return new Map(dids.map(did => [did, byDid.get(did) ?? []]))
  },
})

const humanBadgeKey = (did: string) => createQueryKey('human-badge', {did})

/**
 * Whether an account shows the "human" badge (it verified a phone number or
 * its identity and chose to show it). Accounts asked about together share
 * one request.
 */
export function useHumanBadgeQuery(did: string | undefined) {
  return useQuery({
    enabled: !!did,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: humanBadgeKey(did ?? ''),
    queryFn: async () => ((await loadBadges(did!)) ?? []).includes('human'),
  })
}

export type BadgeVisibility = {human: boolean; eligible: boolean}

/** Whether the viewer shows the "human" badge, and has earned it */
export function useBadgeVisibilityQuery() {
  return useRewardsQuery<BadgeVisibility>(
    net.krao.kyc.getBadgeVisibility.$lxm,
    'badge-visibility',
  )
}

export function useSetBadgeVisibilityMutation() {
  const getToken = useRewardsAuth()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()
  return useMutation({
    mutationFn: async (human: boolean) => {
      const method = net.krao.kyc.setBadgeVisibility.$lxm
      return rewardsFetch<BadgeVisibility>(method, {
        body: {human},
        token: await getToken(method),
      })
    },
    onSuccess: (visibility, _human) => {
      if (!currentAccount) return
      queryClient.setQueryData(
        createQueryKey('badge-visibility', {did: currentAccount.did}),
        visibility,
      )
      void queryClient.invalidateQueries({
        queryKey: humanBadgeKey(currentAccount.did),
      })
    },
  })
}
