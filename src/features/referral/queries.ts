import {useInfiniteQuery, useMutation, useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {KRAO_REWARDS_DID} from '#/env'
import {com} from '#/lexicons'
import {
  checkReferralCode,
  type KycState,
  type PointsBalance,
  type PointsEntry,
  type Referral,
  type ReferralOverview,
  rewardsFetch,
} from './api'

/**
 * A short-lived token from the user's PDS proving who they are to the
 * rewards service (or another Krao service, by `aud`), scoped to one method.
 */
export function useRewardsAuth() {
  const pdsClient = usePdsClient()
  return async (lxm: string, aud: string = KRAO_REWARDS_DID) => {
    const {token} = await pdsClient.call(com.atproto.server.getServiceAuth, {
      aud,
      lxm: lxm as `${string}.${string}.${string}`,
    })
    return token
  }
}

/** A signed-in query of the rewards service */
export function useRewardsQuery<T>(
  method: string,
  name: string,
  opts: {
    refetchInterval?: (data: T | undefined) => number | false
    refetchOnWindowFocus?: boolean
  } = {},
) {
  const {currentAccount} = useSession()
  const getToken = useRewardsAuth()
  return useQuery({
    enabled: !!currentAccount,
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createQueryKey(name, {did: currentAccount?.did ?? ''}),
    queryFn: async () =>
      rewardsFetch<T>(method, {token: await getToken(method)}),
    refetchInterval: opts.refetchInterval
      ? query => opts.refetchInterval!(query.state.data)
      : undefined,
    refetchOnWindowFocus: opts.refetchOnWindowFocus,
  })
}

/** The viewer's referral code (created on first call) and counts */
export function useReferralOverviewQuery() {
  return useRewardsQuery<ReferralOverview>(
    'net.krao.referral.getOverview',
    'referral-overview',
  )
}

type ReferralPage = {referrals: Referral[]; cursor?: string}

/**
 * Accounts that joined with the viewer's code, newest first, in pages of 25
 * (as many profiles as getProfiles hydrates at once)
 */
export function useReferralsQuery() {
  const {currentAccount} = useSession()
  const getToken = useRewardsAuth()
  const method = 'net.krao.referral.listReferrals'
  return useInfiniteQuery({
    enabled: !!currentAccount,
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createQueryKey('referral-list', {
      did: currentAccount?.did ?? '',
    }),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({pageParam}): Promise<ReferralPage> =>
      rewardsFetch<ReferralPage>(method, {
        params: {limit: '25', ...(pageParam ? {cursor: pageParam} : {})},
        token: await getToken(method),
      }),
    getNextPageParam: (page: ReferralPage) => page.cursor,
  })
}

export function usePointsBalanceQuery() {
  return useRewardsQuery<PointsBalance>(
    'net.krao.points.getBalance',
    'points-balance',
  )
}

export function usePointsEntriesQuery() {
  return useRewardsQuery<{entries: PointsEntry[]}>(
    'net.krao.points.listEntries',
    'points-entries',
  )
}

/**
 * Refreshed while a check is under review, and when the user comes back to
 * the app (eg from the identity provider's page)
 */
export function useKycStatusQuery() {
  return useRewardsQuery<KycState>('net.krao.kyc.getStatus', 'kyc-status', {
    refetchInterval: data => (data?.status === 'pending' ? 10_000 : false),
    refetchOnWindowFocus: true,
  })
}

/** Starts identity verification; resolves to the provider's link */
export function useStartKycMutation() {
  const getToken = useRewardsAuth()
  return useMutation({
    mutationFn: async () => {
      const method = 'net.krao.kyc.startVerification'
      return rewardsFetch<{url: string}>(method, {
        post: true,
        token: await getToken(method),
      })
    },
  })
}

/** Checks a referral code as it is typed in the sign-up form */
export function useReferralCodeCheckQuery(code: string) {
  const normalized = code.trim().toUpperCase()
  return useQuery({
    enabled: /^[A-Z0-9-]{3,32}$/.test(normalized),
    staleTime: STALE.MINUTES.ONE,
    retry: false,
    queryKey: createQueryKey('referral-code-check', {code: normalized}),
    queryFn: () => checkReferralCode(normalized),
  })
}
