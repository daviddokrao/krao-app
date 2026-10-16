import {useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useSession} from '#/state/session'
import {RewardsError, rewardsFetch} from '#/features/referral/api'
import {useRewardsAuth} from '#/features/referral/queries'
import {
  type AnalyticsSummary,
  type Funnel,
  type FunnelRange,
  type Retention,
} from './logic'

const GET_FUNNEL = 'net.krao.analytics.getFunnel'
const GET_RETENTION = 'net.krao.analytics.getRetention'
const GET_SUMMARY = 'net.krao.analytics.getSummary'

const ROOT = 'krao-analytics'

/** The service says no to anyone who is not a rewards admin */
export function isForbidden(error: unknown): boolean {
  return (
    error instanceof RewardsError &&
    (error.status === 401 || error.status === 403)
  )
}

function useAnalyticsCall() {
  const getToken = useRewardsAuth()
  const {currentAccount} = useSession()
  return {
    enabled: !!currentAccount,
    did: currentAccount?.did ?? '',
    call: async <T>(method: string, params?: Record<string, string>) =>
      rewardsFetch<T>(method, {params, token: await getToken(method)}),
  }
}

export function useAnalyticsSummaryQuery({enabled = true} = {}) {
  const {call, enabled: signedIn, did} = useAnalyticsCall()
  return useQuery({
    enabled: signedIn && enabled,
    staleTime: STALE.MINUTES.ONE,
    retry: false,
    queryKey: createQueryKey(ROOT, {kind: 'summary', did}),
    queryFn: () => call<AnalyticsSummary>(GET_SUMMARY),
  })
}

export function useFunnelQuery(
  range: FunnelRange,
  period: {since: string; until: string},
) {
  const {call, enabled, did} = useAnalyticsCall()
  return useQuery({
    enabled,
    staleTime: STALE.MINUTES.ONE,
    retry: false,
    // The period moves with the clock: the range is what identifies the query
    queryKey: createQueryKey(ROOT, {kind: 'funnel', did, range}),
    queryFn: () => call<Funnel>(GET_FUNNEL, period),
  })
}

export function useRetentionQuery(weeks: number) {
  const {call, enabled, did} = useAnalyticsCall()
  return useQuery({
    enabled,
    staleTime: STALE.MINUTES.ONE,
    retry: false,
    queryKey: createQueryKey(ROOT, {kind: 'retention', did, weeks}),
    queryFn: () => call<Retention>(GET_RETENTION, {weeks: String(weeks)}),
  })
}
