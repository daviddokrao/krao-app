import {useMutation, useQuery} from '@tanstack/react-query'

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
 * rewards service, scoped to one method.
 */
function useRewardsAuth() {
  const pdsClient = usePdsClient()
  return async (lxm: string) => {
    const {token} = await pdsClient.call(com.atproto.server.getServiceAuth, {
      aud: KRAO_REWARDS_DID,
      lxm: lxm as `${string}.${string}.${string}`,
    })
    return token
  }
}

/** A signed-in query of the rewards service */
function useRewardsQuery<T>(method: string, name: string) {
  const {currentAccount} = useSession()
  const getToken = useRewardsAuth()
  return useQuery({
    enabled: !!currentAccount,
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createQueryKey(name, {did: currentAccount?.did ?? ''}),
    queryFn: async () =>
      rewardsFetch<T>(method, {token: await getToken(method)}),
  })
}

/** The viewer's referral code (created on first call) and counts */
export function useReferralOverviewQuery() {
  return useRewardsQuery<ReferralOverview>(
    'net.krao.referral.getOverview',
    'referral-overview',
  )
}

/** Accounts that joined with the viewer's code, newest first */
export function useReferralsQuery() {
  return useRewardsQuery<{referrals: Referral[]}>(
    'net.krao.referral.listReferrals',
    'referral-list',
  )
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

export function useKycStatusQuery() {
  return useRewardsQuery<KycState>('net.krao.kyc.getStatus', 'kyc-status')
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
