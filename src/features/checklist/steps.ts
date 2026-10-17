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
  /**
   * When this device first saw the account as new, in ms. Stands in for the
   * creation date when the appview has none, so the card stays once the user
   * starts on the steps.
   */
  since?: number
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
 * Whether the account counts as new: under 30 days old, counted from its
 * creation date or else from when this device first saw it as new (`since`).
 * Krao's appview only has a creation date once the account has a profile
 * record; an account with neither date and no posts or follows yet has done
 * nothing on Krao, so it is new too.
 */
export function isNewAccount(
  {
    createdAt,
    since,
    postsCount = 0,
    followsCount = 0,
  }: {
    createdAt?: string
    since?: number
    postsCount?: number
    followsCount?: number
  },
  now: number = Date.now(),
): boolean {
  const created = createdAt ? Date.parse(createdAt) : NaN
  const start = Number.isNaN(created) ? since : created
  if (start === undefined || Number.isNaN(start)) {
    return postsCount === 0 && followsCount === 0
  }
  return now - start < NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000
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
