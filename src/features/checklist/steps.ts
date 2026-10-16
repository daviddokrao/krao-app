/*
 * The new-user checklist: five first steps, each detected from data the app
 * already has (profile, follows, posts, linked wallets, tips). Kept free of
 * React so the rules are easy to test.
 */

export type ChecklistStepId = 'avatar' | 'follow' | 'post' | 'wallet' | 'tip'

export const CHECKLIST_STEPS: ChecklistStepId[] = [
  'avatar',
  'follow',
  'post',
  'wallet',
  'tip',
]

/** Follow this many accounts to fill the second step */
export const FOLLOW_TARGET = 5

/** An account is "new" for this long after it was created */
export const NEW_ACCOUNT_DAYS = 30

export type ChecklistFacts = {
  avatar?: string
  followsCount?: number
  postsCount?: number
  wallets?: {status: string}[]
  badges?: {id: string}[]
}

/** Which steps the account's current data completes */
export function detectSteps(facts: ChecklistFacts): Set<ChecklistStepId> {
  const done = new Set<ChecklistStepId>()
  if (facts.avatar) done.add('avatar')
  if ((facts.followsCount ?? 0) >= FOLLOW_TARGET) done.add('follow')
  if ((facts.postsCount ?? 0) >= 1) done.add('post')
  /*
   * A wallet that was just linked counts while the indexer is still checking
   * it; only one the indexer rejected does not.
   */
  if (facts.wallets?.some(w => w.status !== 'invalid')) done.add('wallet')
  if (facts.badges?.some(b => b.id === 'tipper')) done.add('tip')
  return done
}

export type StoredChecklist = {
  /** Steps seen done before, so a step stays ticked (eg after an unfollow) */
  done?: ChecklistStepId[]
  dismissed?: boolean
}

const VALID_STEPS = new Set<string>(CHECKLIST_STEPS)

/** Steps done now or earlier, in checklist order */
export function mergeDone(
  stored: StoredChecklist | undefined,
  detected: Set<ChecklistStepId>,
): ChecklistStepId[] {
  const before = new Set(
    (stored?.done ?? []).filter((id): id is ChecklistStepId =>
      VALID_STEPS.has(id),
    ),
  )
  return CHECKLIST_STEPS.filter(id => before.has(id) || detected.has(id))
}

/**
 * Whether the account counts as new: under 30 days old when its creation date
 * is known. Krao's appview only has a date once the account has a profile
 * record; an account with none and no posts or follows yet has done nothing
 * on Krao, so it is treated as new too.
 */
export function isNewAccount(
  {
    createdAt,
    postsCount = 0,
    followsCount = 0,
  }: {createdAt?: string; postsCount?: number; followsCount?: number},
  now: number = Date.now(),
): boolean {
  const created = createdAt ? Date.parse(createdAt) : NaN
  if (Number.isNaN(created)) return postsCount === 0 && followsCount === 0
  return now - created < NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000
}

export function isChecklistComplete(done: ChecklistStepId[]): boolean {
  return CHECKLIST_STEPS.every(id => done.includes(id))
}

/**
 * Whether the card shows: only for new accounts, until every step is done or
 * the user closes it. `ready` is false while the data it depends on loads, so
 * the card does not flash for an account that turns out to be done.
 */
export function shouldShowChecklist({
  ready,
  dismissed,
  newAccount,
  done,
}: {
  ready: boolean
  dismissed: boolean
  newAccount: boolean
  done: ChecklistStepId[]
}): boolean {
  return ready && !dismissed && newAccount && !isChecklistComplete(done)
}
