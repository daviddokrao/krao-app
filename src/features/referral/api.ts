import {KRAO_REWARDS_URL, KRAO_WEB_URL} from '#/env'

/*
 * Krao's rewards service (@krao/rewards in krao-atproto): referral codes,
 * points and identity verification. Signed-in calls carry a service auth
 * token from the user's PDS, addressed to the service and the method.
 */

export type KycStatus = 'none' | 'pending' | 'retry' | 'approved' | 'rejected'

export type ReferralOverview = {
  code: string
  invitedBy?: string
  referralCount: number
  verifiedCount: number
}

export type Referral = {
  did: string
  joinedAt: string
  verified: boolean
}

export type PointsBalance = {pending: number; approved: number}

export type PointsEntry = {
  id: string
  amount: number
  status: 'pending' | 'approved' | 'void'
  ruleId?: string
  relatedDid?: string
  waitingFor: ('kyc:self' | 'kyc:related')[]
  note?: string
  createdAt: string
  decidedAt?: string
}

export type KycState = {
  status: KycStatus
  /** Whether verification can be started (a provider is configured) */
  available: boolean
  updatedAt?: string
}

export class RewardsError extends Error {
  constructor(
    public error: string | undefined,
    message: string,
  ) {
    super(message)
  }
}

export async function rewardsFetch<T>(
  method: string,
  {
    params,
    token,
    post,
  }: {
    params?: Record<string, string>
    token?: string
    /** A procedure; none of the rewards procedures the app calls take input */
    post?: boolean
  } = {},
): Promise<T> {
  const url = new URL(`/xrpc/${method}`, KRAO_REWARDS_URL)
  for (const [k, v] of Object.entries(params ?? {})) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    method: post ? 'POST' : 'GET',
    headers: token ? {authorization: `Bearer ${token}`} : {},
  })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const {error, message} = data as {error?: string; message?: string}
    throw new RewardsError(error, message ?? `HTTP ${res.status}`)
  }
  return data as T
}

/** Whether a code may be used to sign up, and whose it is. Public. */
export function checkReferralCode(code: string) {
  return rewardsFetch<{valid: boolean; referrer?: string}>(
    'net.krao.referral.checkCode',
    {params: {code}},
  )
}

/** The link that opens sign-up with the code filled in */
export function getReferralUrl(code: string) {
  return `${KRAO_WEB_URL.replace(/\/$/, '')}/join/${code}`
}
