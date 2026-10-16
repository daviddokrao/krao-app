import {TID} from '@atproto/common-web'
import {type Client} from '@atproto/lex'
import {type AtIdentifierString, AtUri, toDatetimeString} from '@atproto/syntax'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient, usePdsClient, useSession} from '#/state/session'
import {KRAO_GATE_DID} from '#/env'
import {indexerFetch} from '#/features/community/api'
import {useRewardsAuth} from '#/features/referral/queries'
import {TIP_ASSETS, type TipAsset} from '#/features/tips/assets'
import {transferFromLinkedWallet} from '#/features/tips/queries'
import {app, com} from '#/lexicons'
import {
  buildPaymentRecord,
  buildPlanRecord,
  type MembershipStatus,
  PAYMENT_COLLECTION,
  type PaymentRecord,
  PLAN_COLLECTION,
  type PlanDraft,
  type PlanRecord,
} from './logic'
import {
  pendingPaymentsFor,
  removePendingPayment,
  savePendingPayment,
} from './pendingPayments'

/*
 * The membership methods of Krao's indexer. The lexicons
 * (net.krao.membership.*) are typed here, not generated, so the app builds
 * before they are installed.
 */

export type PlanView = {
  uri: string
  cid: string
  creator: string
  name: string
  description?: string
  priceUsdc: string
  perks?: string[]
  active: boolean
  memberCount: number
}

export type MembershipView = {
  creator: string
  member: string
  /** at:// URI of the plan (see net.krao.membership.defs#membershipView) */
  plan: string
  status: MembershipStatus
  since: string
  expiresAt?: string
  /** Why the membership is invalid (from the indexer, in English) */
  reason?: string
}

export type MemberProfile = app.bsky.actor.defs.ProfileViewDetailed

export type MembershipWithProfile = MembershipView & {
  profile?: MemberProfile
}

const KEY_ROOT = 'krao-membership'

const GETPLANS = 'net.krao.membership.getPlans'
const GETSTATUS = 'net.krao.membership.getStatus'
const LISTMINE = 'net.krao.membership.listMyMemberships'
const LISTMEMBERS = 'net.krao.membership.listMembers'

export const USDC: TipAsset = TIP_ASSETS.find(a => a.symbol === 'USDC')!

const nextCursor = (page: {cursor?: string}) => page.cursor

/** A token for the indexer, scoped to one method */
function useIndexerAuth() {
  const getToken = useRewardsAuth()
  return (lxm: string) => getToken(lxm, KRAO_GATE_DID)
}

/** Adds each account's profile, fetched in batches rather than one by one */
async function withProfiles<T extends {member: string}>(
  client: Client,
  rows: T[],
): Promise<(T & {profile?: MemberProfile})[]> {
  const byDid = new Map<string, MemberProfile>()
  const dids = rows.map(r => r.member)
  for (let i = 0; i < dids.length; i += 25) {
    try {
      const res = await client.call(app.bsky.actor.getProfiles, {
        actors: dids.slice(i, i + 25) as AtIdentifierString[],
      })
      for (const profile of res.profiles) byDid.set(profile.did, profile)
    } catch {
      // Rows without a profile show their DID
    }
  }
  return rows.map(r => ({...r, profile: byDid.get(r.member)}))
}

/** The plans a creator offers that people can still join */
export function usePlansQuery(creator: string | undefined) {
  return useQuery({
    enabled: !!creator,
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createQueryKey(KEY_ROOT, {kind: 'plans', creator: creator ?? ''}),
    queryFn: async () => {
      const res = await indexerFetch<{plans: PlanView[]}>(GETPLANS, {
        params: {creator},
      })
      return res.plans
    },
  })
}

/** A plan as stored in its creator's repo */
export type OwnPlan = {
  uri: string
  cid: string
  rkey: string
  record: PlanRecord
  memberCount: number
}

/**
 * The signed-in creator's plans, including deactivated ones: read from their
 * own repo, with member counts from the indexer.
 */
export function useOwnPlansQuery() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  return useQuery({
    enabled: !!currentAccount,
    staleTime: STALE.SECONDS.FIFTEEN,
    queryKey: createQueryKey(KEY_ROOT, {
      kind: 'own-plans',
      did: currentAccount?.did ?? '',
    }),
    queryFn: async (): Promise<OwnPlan[]> => {
      const did = currentAccount!.did
      const page = await pdsClient.call(com.atproto.repo.listRecords, {
        repo: did,
        collection: PLAN_COLLECTION,
        limit: 100,
      })
      const counts = new Map<string, number>()
      try {
        const res = await indexerFetch<{plans: PlanView[]}>(GETPLANS, {
          params: {creator: did},
        })
        for (const plan of res.plans) counts.set(plan.uri, plan.memberCount)
      } catch {
        // Counts are a nicety: the plans still show
      }
      return page.records
        .map(r => ({
          uri: r.uri,
          cid: r.cid,
          rkey: new AtUri(r.uri).rkey,
          record: r.value as unknown as PlanRecord,
          memberCount: counts.get(r.uri) ?? 0,
        }))
        .sort((a, b) => (a.record.createdAt < b.record.createdAt ? -1 : 1))
    },
  })
}

function useInvalidateMembership() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({queryKey: [KEY_ROOT]})
}

/** Create a plan, or change one of the creator's plans */
export function useSavePlanMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const invalidate = useInvalidateMembership()
  return useMutation({
    mutationFn: async ({
      draft,
      existing,
      active = true,
    }: {
      draft: PlanDraft
      existing?: OwnPlan
      active?: boolean
    }) => {
      if (!currentAccount) throw new Error('Not signed in')
      const record = buildPlanRecord(draft, {
        active,
        createdAt: existing?.record.createdAt ?? toDatetimeString(new Date()),
      })
      if (existing) {
        await pdsClient.call(com.atproto.repo.putRecord, {
          repo: currentAccount.did,
          collection: PLAN_COLLECTION,
          rkey: existing.rkey,
          record,
        })
      } else {
        await pdsClient.call(com.atproto.repo.createRecord, {
          repo: currentAccount.did,
          collection: PLAN_COLLECTION,
          rkey: TID.nextStr(),
          record,
        })
      }
    },
    onSuccess: () => {
      // The indexer picks the record up from the firehose a moment later
      void invalidate()
      for (const delay of [1000, 3000])
        setTimeout(() => void invalidate(), delay)
    },
  })
}

/** Turn a plan off (new people can no longer join it) or back on */
export function useSetPlanActiveMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const invalidate = useInvalidateMembership()
  return useMutation({
    mutationFn: async ({plan, active}: {plan: OwnPlan; active: boolean}) => {
      if (!currentAccount) throw new Error('Not signed in')
      await pdsClient.call(com.atproto.repo.putRecord, {
        repo: currentAccount.did,
        collection: PLAN_COLLECTION,
        rkey: plan.rkey,
        record: {...plan.record, active},
      })
    },
    onSuccess: () => {
      void invalidate()
      for (const delay of [1000, 3000])
        setTimeout(() => void invalidate(), delay)
    },
  })
}

/** The viewer's membership of one creator, if any */
export function useMembershipStatusQuery(
  creator: string | undefined,
  options: {
    refetchInterval?: number | false
    /** Refetch every few seconds while a payment is being checked */
    pollWhilePending?: boolean
  } = {},
) {
  const {currentAccount} = useSession()
  const getToken = useIndexerAuth()
  return useQuery({
    enabled: !!creator && !!currentAccount && creator !== currentAccount.did,
    staleTime: STALE.SECONDS.FIFTEEN,
    queryKey: createQueryKey(KEY_ROOT, {
      kind: 'status',
      creator: creator ?? '',
      viewer: currentAccount?.did ?? '',
    }),
    queryFn: async () => {
      const res = await indexerFetch<{membership?: MembershipView}>(GETSTATUS, {
        params: {creator},
        token: await getToken(GETSTATUS),
      })
      return res.membership ?? null
    },
    refetchInterval: options.pollWhilePending
      ? query => (query.state.data?.status === 'pending' ? 5000 : false)
      : options.refetchInterval,
  })
}

/** Creators the viewer is, or was, a member of */
export function useMyMembershipsQuery() {
  const {currentAccount} = useSession()
  const getToken = useIndexerAuth()
  return useInfiniteQuery({
    enabled: !!currentAccount,
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createQueryKey(KEY_ROOT, {
      kind: 'mine',
      viewer: currentAccount?.did ?? '',
    }),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({pageParam}) =>
      indexerFetch<{memberships: MembershipView[]; cursor?: string}>(LISTMINE, {
        params: {limit: 50, cursor: pageParam},
        token: await getToken(LISTMINE),
      }),
    getNextPageParam: nextCursor,
  })
}

/** People who joined the signed-in creator, by active or expired */
export function useMembersQuery(status: 'active' | 'expired') {
  const {currentAccount} = useSession()
  const client = useAppviewClient()
  const getToken = useIndexerAuth()
  return useInfiniteQuery({
    enabled: !!currentAccount,
    staleTime: STALE.SECONDS.THIRTY,
    queryKey: createQueryKey(KEY_ROOT, {
      kind: 'members',
      status,
      creator: currentAccount?.did ?? '',
    }),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({pageParam}) => {
      const page = await indexerFetch<{
        members: MembershipView[]
        cursor?: string
      }>(LISTMEMBERS, {
        params: {status, limit: 50, cursor: pageParam},
        token: await getToken(LISTMEMBERS),
      })
      return {...page, members: await withProfiles(client, page.members)}
    },
    getNextPageParam: nextCursor,
  })
}

/** Attaches the creators' profiles to a flat list of memberships */
export function useCreatorProfiles(memberships: MembershipView[]) {
  const client = useAppviewClient()
  const dids = [...new Set(memberships.map(m => m.creator))]
  return useQuery({
    enabled: dids.length > 0,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: createQueryKey(KEY_ROOT, {kind: 'creator-profiles', dids}),
    queryFn: async () => {
      const rows = await withProfiles(
        client,
        dids.map(did => ({member: did})),
      )
      return new Map(rows.map(r => [r.member, r.profile]))
    },
  })
}

/** The payment failed after the money moved: only the record is left */
export class PaymentNotRecordedError extends Error {}

/** The plan changed or closed since it was shown: nothing was paid */
export class PlanChangedError extends Error {}

/** Identifies the payment mutation, so a second dialog can see one running */
export const SUBSCRIBE_MUTATION_KEY = [KEY_ROOT, 'subscribe']

const RECORD_RETRY_DELAYS_MS = [0, 1000, 3000]
/** How long to wait for the indexer to verify the transfer */
const VERIFY_POLL_MS = 2000
const VERIFY_POLL_TRIES = 30

async function writePendingPayment(
  pdsClient: ReturnType<typeof usePdsClient>,
  did: string,
  rkey: string,
  record: PaymentRecord,
) {
  await pdsClient.call(com.atproto.repo.putRecord, {
    repo: did as `did:${string}:${string}`,
    collection: PAYMENT_COLLECTION,
    rkey,
    record,
  })
  removePendingPayment(record.txHash)
}

/**
 * Save the records of payments that were sent but not recorded. Never moves
 * money: this is what to offer after PaymentNotRecordedError.
 */
export function useSavePendingPaymentsMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const invalidate = useInvalidateMembership()
  return useMutation({
    mutationFn: async () => {
      if (!currentAccount) throw new Error('Not signed in')
      for (const {rkey, record} of pendingPaymentsFor(currentAccount.did)) {
        await writePendingPayment(pdsClient, currentAccount.did, rkey, record)
      }
    },
    onSuccess: () => void invalidate(),
  })
}

/**
 * Join a plan or renew: pay its price in USDC from the viewer's linked
 * wallet straight to the creator's, write the payment record, then wait for
 * the indexer to verify the transfer. Resolves with `confirmed: false` when
 * the indexer has not caught up yet; the membership then turns up on its own.
 */
export function useSubscribeMutation() {
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  const getToken = useIndexerAuth()
  const invalidate = useInvalidateMembership()
  return useMutation({
    mutationKey: SUBSCRIBE_MUTATION_KEY,
    mutationFn: async ({
      plan,
      creatorAddress,
      previousExpiresAt,
      onPhase,
    }: {
      plan: PlanView
      creatorAddress: string
      /** The current expiry when renewing: a later one means it counted */
      previousExpiresAt?: string
      onPhase?: (phase: 'paying' | 'confirming') => void
    }) => {
      if (!currentAccount) throw new Error('Not signed in')
      const did = currentAccount.did
      // Payments made earlier whose record failed to save
      let unsavedHere = false
      let savedHere = false
      for (const {rkey, record} of pendingPaymentsFor(did)) {
        const saved = await writePendingPayment(pdsClient, did, rkey, record)
          .then(() => true)
          .catch(() => false)
        if (record.creator === plan.creator) {
          if (saved) savedHere = true
          else unsavedHere = true
        }
      }
      /*
       * A payment to this creator was already sent from this device: never
       * charge again. Its record is saved now, or still has to be.
       */
      if (unsavedHere) {
        throw new PaymentNotRecordedError('Earlier payment not recorded')
      }
      if (savedHere) return {txHash: undefined, confirmed: false}

      // Pay only what was shown: the indexer checks against the current plan
      const current = await indexerFetch<{plans: PlanView[]}>(GETPLANS, {
        params: {creator: plan.creator},
      })
      const fresh = current.plans.find(p => p.uri === plan.uri)
      if (
        !fresh ||
        !fresh.active ||
        fresh.cid !== plan.cid ||
        fresh.priceUsdc !== plan.priceUsdc
      ) {
        throw new PlanChangedError()
      }
      onPhase?.('paying')
      const {txHash} = await transferFromLinkedWallet({
        queryClient,
        did,
        asset: USDC,
        to: creatorAddress,
        amount: BigInt(plan.priceUsdc),
      })
      const record = buildPaymentRecord({
        plan: {uri: plan.uri, cid: plan.cid},
        creator: plan.creator,
        txHash,
        createdAt: toDatetimeString(new Date()),
      })
      // The money has moved: keep the record until it is written
      const rkey = TID.nextStr()
      savePendingPayment(did, rkey, record)
      for (const [i, delay] of RECORD_RETRY_DELAYS_MS.entries()) {
        await new Promise(resolve => setTimeout(resolve, delay))
        try {
          await writePendingPayment(pdsClient, did, rkey, record)
          break
        } catch (err) {
          if (i === RECORD_RETRY_DELAYS_MS.length - 1) {
            throw new PaymentNotRecordedError(String(err))
          }
        }
      }

      onPhase?.('confirming')
      for (let i = 0; i < VERIFY_POLL_TRIES; i++) {
        await new Promise(resolve => setTimeout(resolve, VERIFY_POLL_MS))
        try {
          const res = await indexerFetch<{membership?: MembershipView}>(
            GETSTATUS,
            {
              params: {creator: plan.creator},
              token: await getToken(GETSTATUS),
            },
          )
          const m = res.membership
          if (
            m?.status === 'active' &&
            (!previousExpiresAt || m.expiresAt !== previousExpiresAt)
          ) {
            return {txHash, confirmed: true}
          }
          if (m?.status === 'invalid') return {txHash, confirmed: false}
        } catch {
          // Keep trying until the time is up
        }
      }
      return {txHash, confirmed: false}
    },
    onSettled: () => {
      void invalidate()
      // Members-only posts the viewer could not open before
      void queryClient.invalidateQueries({queryKey: ['gated-content']})
    },
  })
}
