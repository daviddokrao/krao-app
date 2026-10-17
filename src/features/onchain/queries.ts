import {useInfiniteQuery, useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {indexerFetch} from '#/features/community/api'
import {
  type OnchainProfile,
  type SupportDirection,
  type SupportItem,
} from './logic'

const GET_ONCHAIN_PROFILE = 'net.krao.actor.getOnchainProfile'
const GET_SUPPORT_HISTORY = 'net.krao.actor.getSupportHistory'

const ROOT = 'krao-onchain'

/** Public: wallets, NFTs and support of an account. NotFound for taken-down ones. */
export function useOnchainProfileQuery(did: string | undefined) {
  return useQuery({
    enabled: !!did,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: createQueryKey(ROOT, {kind: 'profile', did: did ?? ''}),
    queryFn: () =>
      indexerFetch<OnchainProfile>(GET_ONCHAIN_PROFILE, {
        params: {actor: did},
      }),
    // Without an answer the tab stays hidden; no point in retrying
    retry: false,
  })
}

export function useSupportHistoryQuery(
  did: string,
  direction: SupportDirection,
  {enabled = true} = {},
) {
  return useInfiniteQuery({
    enabled,
    staleTime: STALE.MINUTES.ONE,
    queryKey: createQueryKey(ROOT, {kind: 'history', did, direction}),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({pageParam}) =>
      indexerFetch<{items: SupportItem[]; cursor?: string}>(
        GET_SUPPORT_HISTORY,
        {params: {actor: did, direction, limit: 25, cursor: pageParam}},
      ),
    getNextPageParam: page => page.cursor,
  })
}
