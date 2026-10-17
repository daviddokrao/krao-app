import {useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useSession} from '#/state/session'
import {KRAO_GATE_DID} from '#/env'
import {indexerFetch} from '#/features/community/api'
import {useRewardsAuth} from '#/features/referral/queries'

/*
 * net.krao.creator.*: figures about a creator's supporters and audience. The
 * lexicons are typed here, not generated, so the app builds before they are
 * installed.
 */

/** Query key root, also used to refresh the list after a tip */
export const TOP_SUPPORTERS_KEY = 'krao-top-supporters'

const GET_TOP_SUPPORTERS = 'net.krao.creator.getTopSupporters'
const GET_STATS = 'net.krao.creator.getStats'

export type Supporter = {
  /** Missing when the supporter chose to be anonymous */
  did?: string
  anonymous: boolean
  /** US dollars with 2 decimals, eg "12.50" */
  totalUsd: string
  /** Verified tips and membership payments counted */
  tipCount: number
}

/** net.krao.creator.getStats; dollar amounts have 2 decimals ("12.50") */
export type CreatorStats = {
  tips30d: {count: number; totalUsd: string}
  members: {active: number; new30d: number; expired30d: number}
  followers: {now: number; change30d?: number}
  /** The last 30 UTC days, oldest first; `date` is YYYY-MM-DD */
  daily: {date: string; tipsUsd: string; newMembers: number}[]
}

/** The accounts that tipped an account the most, highest first */
export function useTopSupportersQuery(did: string, limit = 5) {
  return useQuery({
    enabled: !!did,
    staleTime: STALE.MINUTES.ONE,
    queryKey: createQueryKey(TOP_SUPPORTERS_KEY, {did, limit}),
    queryFn: async () => {
      const res = await indexerFetch<{supporters: Supporter[]}>(
        GET_TOP_SUPPORTERS,
        {params: {actor: did, limit}},
      )
      return res.supporters
    },
  })
}

/** The signed-in creator's dashboard figures */
export function useCreatorStatsQuery() {
  const {currentAccount} = useSession()
  const getToken = useRewardsAuth()
  return useQuery({
    enabled: !!currentAccount,
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createQueryKey('krao-creator-stats', {
      did: currentAccount?.did ?? '',
    }),
    queryFn: async () =>
      indexerFetch<CreatorStats>(GET_STATS, {
        token: await getToken(GET_STATS, KRAO_GATE_DID),
      }),
  })
}
