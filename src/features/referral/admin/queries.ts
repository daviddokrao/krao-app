import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useSession} from '#/state/session'
import {type KycStatus, type PointsEntry, rewardsFetch} from '../api'
import {useRewardsAuth} from '../queries'

/*
 * net.krao.rewards.admin.*: what Krao admins and KYC reviewers use to run
 * referrals. The service checks the caller's role on every call.
 */

export type Role = 'admin' | 'kyc_reviewer'

export type KycRecord = {
  did: string
  status: KycStatus
  provider?: string
  rejectReason?: string
  pendingSecondApproval?: boolean
  updatedAt: string
}

export type CodeKind = 'personal' | 'campaign' | 'partner'

export type CodeView = {
  code: string
  kind: CodeKind
  ownerDid?: string
  campaignId?: string
  maxUses?: number
  uses: number
  expiresAt?: string
  disabled: boolean
  note?: string
  createdBy?: string
  createdAt: string
}

export type Rule = {
  id: string
  version: number
  enabled: boolean
  description?: string
  event: 'account.created' | 'kyc.approved'
  beneficiary: 'actor' | 'referrer' | 'referrer2'
  amount: number
  vesting: ('kyc:self' | 'kyc:related')[]
  codeKinds?: CodeKind[]
  campaignId?: string
  validFrom?: string
  validUntil?: string
  capPerBeneficiary?: number
  capPerDay?: number
  updatedAt?: string
  updatedBy?: string
}

export type AuditEntry = {
  id: number
  actor: string
  action: string
  subject?: string
  data?: string
  createdAt: string
}

export type ReasonCode =
  | 'provider_outage'
  | 'provider_false_reject'
  | 'unsupported_document'
  | 'partner_verified'
  | 'fraud'
  | 'other'

const ADMIN = 'net.krao.rewards.admin'

function useAdminCall() {
  const getToken = useRewardsAuth()
  return async <T>(
    method: string,
    opts: {params?: Record<string, string>; body?: unknown} = {},
  ) => rewardsFetch<T>(method, {...opts, token: await getToken(method)})
}

/** The viewer's admin roles; empty for everyone else */
export function useRewardsRolesQuery() {
  const {currentAccount} = useSession()
  const call = useAdminCall()
  return useQuery({
    enabled: !!currentAccount,
    staleTime: STALE.MINUTES.FIVE,
    retry: false,
    queryKey: createQueryKey('rewards-roles', {did: currentAccount?.did ?? ''}),
    queryFn: async () =>
      (await call<{roles: Role[]}>('net.krao.rewards.getRoles')).roles,
  })
}

const adminKey = (name: string, args: Record<string, string> = {}) =>
  createQueryKey('rewards-admin', {name, ...args})

export function useKycQueueQuery(status: KycStatus | 'all') {
  const call = useAdminCall()
  return useQuery({
    staleTime: STALE.SECONDS.FIFTEEN,
    queryKey: adminKey('kyc', {status}),
    queryFn: async () =>
      (
        await call<{records: KycRecord[]}>(`${ADMIN}.listKyc`, {
          params: status === 'all' ? {} : {status},
        })
      ).records,
  })
}

export function useCodesQuery() {
  const call = useAdminCall()
  return useQuery({
    staleTime: STALE.SECONDS.FIFTEEN,
    queryKey: adminKey('codes'),
    queryFn: async () =>
      (
        await call<{codes: CodeView[]}>(`${ADMIN}.listCodes`, {
          params: {limit: '100'},
        })
      ).codes.filter(c => c.kind !== 'personal'),
  })
}

export function useRulesQuery() {
  const call = useAdminCall()
  return useQuery({
    staleTime: STALE.SECONDS.FIFTEEN,
    queryKey: adminKey('rules'),
    queryFn: async () =>
      (await call<{rules: Rule[]}>(`${ADMIN}.listRules`)).rules,
  })
}

export function useAuditLogQuery() {
  const call = useAdminCall()
  return useQuery({
    staleTime: STALE.SECONDS.FIFTEEN,
    queryKey: adminKey('audit'),
    queryFn: async () =>
      (
        await call<{entries: AuditEntry[]}>(`${ADMIN}.listAuditLog`, {
          params: {limit: '100'},
        })
      ).entries,
  })
}

/** A procedure; refreshes every admin list once it succeeds */
function useAdminMutation<I, O>(method: string) {
  const call = useAdminCall()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: I) => call<O>(`${ADMIN}.${method}`, {body: input}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: ['rewards-admin']})
      // The viewer's own overview shows what the rules give
      await queryClient.invalidateQueries({queryKey: ['referral-overview']})
    },
  })
}

export const useReviewKycMutation = () =>
  useAdminMutation<
    {
      did: string
      decision: 'approve' | 'reject'
      reasonCode: ReasonCode
      note: string
    },
    KycRecord
  >('reviewKyc')

export const useCreateCodeMutation = () =>
  useAdminMutation<
    {
      code?: string
      kind: 'campaign' | 'partner'
      ownerDid?: string
      campaignId?: string
      maxUses?: number
      expiresAt?: string
      note?: string
    },
    CodeView
  >('createCode')

export const useUpdateCodeMutation = () =>
  useAdminMutation<{code: string; disabled?: boolean}, CodeView>('updateCode')

export const useUpsertRuleMutation = () =>
  useAdminMutation<Omit<Rule, 'updatedAt' | 'updatedBy'>, Rule>('upsertRule')

export const useAdjustPointsMutation = () =>
  useAdminMutation<{did: string; amount: number; note: string}, PointsEntry>(
    'adjustPoints',
  )

export const useRevokePointsMutation = () =>
  useAdminMutation<
    {did: string; note: string},
    {voided: number; reversed: number}
  >('revokePoints')
